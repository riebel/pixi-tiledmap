/**
 * Measures the per-frame cost of animated map tiles in a real browser.
 *
 * Our Vitest benchmarks run in jsdom without a renderer, so they cannot answer
 * the question that decides whether animated tiles should become packed quads:
 * what does a frame cost once the tiles are on screen? This script serves a
 * page to headless Chrome that builds the same 4096 tiles three ways and times
 * `render()` plus a `gl.finish()` sync point for each.
 *
 * It measures Pixi primitives directly, not this package, so both sides are
 * compared without renderer bookkeeping in between:
 *
 * - `animated sprites`: one `AnimatedSprite` per tile, advanced from one
 *   listener, which is what `TileLayerRenderer` builds today.
 * - `packed mesh`: one batched `Mesh` of 4096 quads whose UVs are rewritten
 *   when the animation frame changes, which is the packed-quad proposal.
 * - `static sprites` / `static mesh`: the same scenes without animation, to
 *   separate the cost of the animation from the cost of the scene shape.
 *
 * Usage: npm run measure:animated
 *
 * Configured through the environment, like the MagicLand visual test:
 * `MEASURE_TILES` (4096), `MEASURE_FRAMES` (300), `MEASURE_ANIMATED` (all
 * tiles), and `MEASURE_GPU=1` for Chrome's real GPU.
 *
 * Chrome renders through SwiftShader unless `MEASURE_GPU=1` is set. Software
 * rasterisation inflates fill and upload costs, so the reported GL renderer
 * string is part of the result: compare runs made on the same backend.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { measureInChrome, readCount, resultsPosterSource } from './headlessChrome.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const tiles = readCount('MEASURE_TILES', 4096)
const config = {
  tiles,
  frames: readCount('MEASURE_FRAMES', 300),
  // Every tile animates unless fewer are asked for.
  animated: Math.min(readCount('MEASURE_ANIMATED', tiles), tiles),
  gpu: process.env.MEASURE_GPU === '1'
}

const pixiBundle = join(root, 'node_modules', 'pixi.js', 'dist', 'pixi.js')

if (!existsSync(pixiBundle)) {
  throw new Error(`PixiJS UMD bundle not found at ${pixiBundle}; run npm install first.`)
}

report(
  await measureInChrome(
    {
      '/': { type: 'text/html', body: renderPage },
      '/pixi.js': { type: 'text/javascript', body: () => readFileSync(pixiBundle) }
    },
    { gpu: config.gpu }
  )
)

function report(results) {
  if (results.error) {
    console.error(`The page failed: ${results.error}`)
    process.exitCode = 1
    return
  }

  console.log(`GL renderer: ${results.glRenderer}`)
  console.log(
    `${results.tiles} tiles, ${results.animated} of them animated, ` +
      `${results.frames} timed frames per scene`
  )
  console.log()

  const width = Math.max(...results.scenes.map((scene) => scene.name.length))
  const header = `${'scene'.padEnd(width)}      per frame  frame changes  steady frames    worst frame`
  console.log(header)
  for (const scene of results.scenes) {
    console.log(
      `${scene.name.padEnd(width)} ${fmt(scene.perFrame)} ${fmt(scene.changeFrames)}` +
        `${fmt(scene.steadyFrames)} ${fmt(scene.worstFrame)}`
    )
  }
  console.log()
  console.log('ms, lower is better. "per frame" is the whole timed run divided by its')
  console.log('frame count, which avoids the 100us clamp on performance.now(); the other')
  console.log('columns are per-frame samples at that resolution. Draw calls are not measured.')
}

function fmt(ms) {
  return `${ms.toFixed(3)}ms`.padStart(13)
}

function renderPage() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>html, body { margin: 0; background: #222; }</style>
    <script src="/pixi.js"></script>
  </head>
  <body>
    <script>
      const TILES = ${config.tiles};
      const ANIMATED = ${config.animated};
      const FRAMES = ${config.frames};
      const WARMUP = 20;
      const TILE = 32;
      // 100ms per animation frame at 60fps: a frame change every 6 renders.
      const FRAME_MS = 100;
      const STEP_MS = 1000 / 60;

      ${measurementSource()}

      ${resultsPosterSource}

      run().then(postResults, (error) => {
        postResults({ error: String(error && error.stack || error) });
      });
    </script>
  </body>
</html>`
}

/** The page's measurement code, kept out of the template for readability. */
function measurementSource() {
  return String.raw`
const { Application, AnimatedSprite, Mesh, MeshGeometry, Rectangle, Sprite, Texture, TextureSource } = PIXI;

/** A two-frame atlas: one 64x32 image holding two distinct 32x32 tiles. */
function makeFrames() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * 2;
  canvas.height = TILE;
  const draw = canvas.getContext('2d');
  draw.fillStyle = '#4488ff';
  draw.fillRect(0, 0, TILE, TILE);
  draw.fillStyle = '#ff8844';
  draw.fillRect(TILE, 0, TILE, TILE);

  const source = new TextureSource({ resource: canvas, width: canvas.width, height: canvas.height });
  return [
    new Texture({ source, frame: new Rectangle(0, 0, TILE, TILE) }),
    new Texture({ source, frame: new Rectangle(TILE, 0, TILE, TILE) })
  ];
}

/** Grid position of tile i, in a square layout. */
function tilePos(index, columns) {
  return [(index % columns) * TILE, Math.floor(index / columns) * TILE];
}

function spriteScene(frames, animated, columns) {
  const scene = new PIXI.Container();
  const sprites = [];
  for (let i = 0; i < TILES; i++) {
    const [x, y] = tilePos(i, columns);
    let sprite;
    if (animated && i < ANIMATED) {
      sprite = new AnimatedSprite(
        [{ texture: frames[0], time: FRAME_MS }, { texture: frames[1], time: FRAME_MS }],
        false
      );
      sprite.play();
      sprites.push(sprite);
    } else {
      sprite = new Sprite(frames[0]);
    }
    sprite.position.set(x, y);
    scene.addChild(sprite);
  }
  return { scene, sprites };
}

/** A batched mesh of 'count' quads starting at tile 'from'. */
function quadMesh(frames, columns, from, count) {
  const positions = new Float32Array(count * 8);
  const uvs = new Float32Array(count * 8);
  const indices = new Uint32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const [x, y] = tilePos(from + i, columns);
    const o = i * 8;
    positions[o] = x; positions[o + 1] = y;
    positions[o + 2] = x + TILE; positions[o + 3] = y;
    positions[o + 4] = x + TILE; positions[o + 5] = y + TILE;
    positions[o + 6] = x; positions[o + 7] = y + TILE;
    const v = i * 6;
    const q = i * 4;
    indices[v] = q; indices[v + 1] = q + 1; indices[v + 2] = q + 2;
    indices[v + 3] = q; indices[v + 4] = q + 2; indices[v + 5] = q + 3;
  }

  const geometry = new MeshGeometry({ positions, uvs, indices });
  geometry.batchMode = 'batch';
  const mesh = new Mesh({ geometry, texture: frames[0] });

  /** Rewrites every quad's UVs to a frame, as a shared animation clock would. */
  function writeFrame(frame) {
    const uv = frames[frame].uvs;
    const target = geometry.uvs;
    for (let o = 0; o < target.length; o += 8) {
      target[o] = uv.x0; target[o + 1] = uv.y0;
      target[o + 2] = uv.x1; target[o + 3] = uv.y1;
      target[o + 4] = uv.x2; target[o + 5] = uv.y2;
      target[o + 6] = uv.x3; target[o + 7] = uv.y3;
    }
    geometry.getBuffer('aUV').update();
  }

  writeFrame(0);
  return { mesh, writeFrame };
}

/**
 * The packed proposal: animated quads in their own mesh, so a frame change
 * only uploads their buffer, and the static remainder in a second mesh.
 */
function meshScene(frames, columns, animatedCount) {
  const scene = new PIXI.Container();
  const animated = quadMesh(frames, columns, 0, animatedCount);
  scene.addChild(animated.mesh);
  if (animatedCount < TILES) {
    scene.addChild(quadMesh(frames, columns, animatedCount, TILES - animatedCount).mesh);
  }
  return { scene, writeFrame: animated.writeFrame };
}

function stats(samples, changed) {
  const changeSamples = samples.filter((_, i) => changed[i]);
  const steadySamples = samples.filter((_, i) => !changed[i]);
  return {
    changeFrames: mean(changeSamples),
    steadyFrames: mean(steadySamples),
    worstFrame: Math.max(...samples)
  };
}

function mean(samples) {
  if (samples.length === 0) return 0;
  return samples.reduce((total, value) => total + value, 0) / samples.length;
}

async function run() {
  const columns = Math.ceil(Math.sqrt(TILES));
  const size = columns * TILE;
  const app = new Application();
  await app.init({ width: size, height: size, preference: 'webgl', background: '#222222' });
  document.body.appendChild(app.canvas);

  const gl = app.renderer.gl;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const glRenderer = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);

  const frames = makeFrames();
  const scenes = [];

  /**
   * Times one scene. 'advance' mutates it for the next frame and reports
   * whether the animation frame changed; the gl.finish() after each render
   * keeps GPU work inside the sample.
   */
  function measure(name, scene, advance) {
    app.stage.removeChildren();
    app.stage.addChild(scene);

    const samples = [];
    const changed = [];
    for (let i = 0; i < WARMUP; i++) {
      advance();
      app.renderer.render(app.stage);
      gl.finish();
    }

    const start = performance.now();
    for (let i = 0; i < FRAMES; i++) {
      const frameStart = performance.now();
      changed.push(advance());
      app.renderer.render(app.stage);
      gl.finish();
      samples.push(performance.now() - frameStart);
    }
    const total = performance.now() - start;

    scenes.push({ name, perFrame: total / FRAMES, ...stats(samples, changed) });
    app.stage.removeChildren();
  }

  /** A shared clock: the animation frame all animated tiles are on. */
  function makeClock() {
    let clock = 0;
    let current = 0;
    return () => {
      clock += STEP_MS;
      const frame = Math.floor(clock / FRAME_MS) % 2;
      const changed = frame !== current;
      current = frame;
      return { frame, changed };
    };
  }

  const animatedSprites = spriteScene(frames, true, columns);
  const ticker = { deltaTime: STEP_MS / (1000 / 60), elapsedMS: STEP_MS, lastTime: 0 };
  const spriteClock = makeClock();
  measure('animated sprites', animatedSprites.scene, () => {
    for (const sprite of animatedSprites.sprites) sprite.update(ticker);
    return spriteClock().changed;
  });
  app.stage.removeChildren();
  animatedSprites.scene.destroy({ children: true });

  const animatedMesh = meshScene(frames, columns, ANIMATED);
  const meshClock = makeClock();
  measure('packed mesh', animatedMesh.scene, () => {
    const tick = meshClock();
    if (tick.changed) animatedMesh.writeFrame(tick.frame);
    return tick.changed;
  });
  animatedMesh.scene.destroy({ children: true });

  const staticSprites = spriteScene(frames, false, columns);
  measure('static sprites', staticSprites.scene, () => false);
  staticSprites.scene.destroy({ children: true });

  const staticMesh = meshScene(frames, columns, TILES);
  measure('static mesh', staticMesh.scene, () => false);
  staticMesh.scene.destroy({ children: true });

  return { glRenderer, tiles: TILES, animated: ANIMATED, frames: FRAMES, scenes };
}
`
}
