/**
 * Measures what a moving camera costs per frame in a real browser.
 *
 * PixiJS v8 bakes a batched mesh's transform into its vertices on the CPU.
 * Unless something between the stage and a tile layer is a render group, a
 * camera that pans or zooms the map, or `applyParallax` moving a layer, makes
 * PixiJS re-transform every packed tile quad of every layer, every frame.
 * Tile and object layers are therefore render groups; this script prices that
 * against the same map with every render group switched off.
 *
 * It loads the built package from `dist/`, so run `npm run build` first.
 *
 * Usage: npm run measure:camera
 *
 * Configured through the environment: `MEASURE_MAP_SIZE` (256, tiles per
 * side), `MEASURE_LAYERS` (4), `MEASURE_FRAMES` (300), and `MEASURE_GPU=1` for
 * Chrome's real GPU. Without it Chrome rasterises in software, which inflates
 * the GPU share of each frame; the reported GL renderer is part of the result.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { measureInChrome, readCount, resultsPosterSource } from './headlessChrome.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const config = {
  mapSize: readCount('MEASURE_MAP_SIZE', 256),
  layers: readCount('MEASURE_LAYERS', 4),
  frames: readCount('MEASURE_FRAMES', 300),
  gpu: process.env.MEASURE_GPU === '1'
}

const pixiModule = join(root, 'node_modules', 'pixi.js', 'dist', 'pixi.mjs')
const distModules = ['renderer/TiledMap.mjs', 'procedural.mjs']

if (!existsSync(pixiModule)) {
  throw new Error(`PixiJS ESM bundle not found at ${pixiModule}; run npm install first.`)
}
if (!existsSync(join(root, 'dist', distModules[0]))) {
  throw new Error('dist/ not found; run npm run build first.')
}

const routes = {
  '/': { type: 'text/html', body: renderPage },
  '/pixi.mjs': { type: 'text/javascript', body: () => readFileSync(pixiModule) },
  // The measured map uses neither GIFs nor advanced blend modes.
  '/shim.mjs': { type: 'text/javascript', body: () => 'export class GifSprite {}' }
}
serveDist(join(root, 'dist'), '/dist/')

report(await measureInChrome(routes, { gpu: config.gpu }))

/** Serves every module `distModules` reach, which the page imports by URL. */
function serveDist(dir, prefix) {
  const pending = [...distModules]
  for (let path = pending.pop(); path; path = pending.pop()) {
    const url = prefix + path
    if (routes[url]) continue
    const source = readFileSync(join(dir, path), 'utf8')
    routes[url] = { type: 'text/javascript', body: () => source }
    for (const [, spec] of source.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
      pending.push(join(dirname(path), spec).replaceAll('\\', '/'))
    }
  }
}

function report(results) {
  if (results.error) {
    console.error(`The page failed: ${results.error}`)
    process.exitCode = 1
    return
  }

  console.log(`GL renderer: ${results.glRenderer}`)
  console.log(
    `${results.mapSize}x${results.mapSize} map, ${results.layers} tile layers, ` +
      `${results.quads} packed quads, ${results.frames} timed frames per scene`
  )
  console.log()

  const width = Math.max(...results.scenes.map((scene) => scene.name.length))
  console.log(`${'scene'.padEnd(width)}    no render groups  layer render groups`)
  for (const scene of results.scenes) {
    console.log(`${scene.name.padEnd(width)} ${fmt(scene.without, 19)} ${fmt(scene.with, 20)}`)
  }
  console.log()
  console.log('ms per frame, lower is better: render() plus a gl.finish() sync point,')
  console.log('the whole timed run divided by its frame count.')
}

function fmt(ms, width) {
  return `${ms.toFixed(3)}ms`.padStart(width)
}

function renderPage() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>html, body { margin: 0; background: #222; }</style>
    <script type="importmap">
      { "imports": {
        "pixi.js": "/pixi.mjs",
        "pixi.js/gif": "/shim.mjs",
        "pixi.js/advanced-blend-modes": "/shim.mjs"
      } }
    </script>
  </head>
  <body>
    <script type="module">
      const SIZE = ${config.mapSize};
      const LAYERS = ${config.layers};
      const FRAMES = ${config.frames};

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
const { Application, Texture } = await import('pixi.js');
const { TiledMap } = await import('/dist/renderer/TiledMap.mjs');
const { createMap } = await import('/dist/procedural.mjs');

const TILE = 16;
const WARMUP = 20;
const VIEW = { width: 800, height: 600 };

/** A 16x16 atlas of distinct 16px tiles. */
function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16 * TILE;
  const draw = canvas.getContext('2d');
  for (let i = 0; i < 256; i++) {
    draw.fillStyle = 'hsl(' + (i * 37) % 360 + ' 60% ' + (30 + (i % 5) * 8) + '%)';
    draw.fillRect((i % 16) * TILE, Math.floor(i / 16) * TILE, TILE, TILE);
  }
  return Texture.from(canvas);
}

/** A full ground layer and sparser layers above it, some of them parallax. */
function makeMapData(parallax) {
  const layers = [];
  for (let l = 0; l < LAYERS; l++) {
    const tiles = new Array(SIZE * SIZE);
    for (let i = 0; i < tiles.length; i++) {
      tiles[i] = l === 0 || (i * 7 + l) % 3 === 0 ? { tileset: 0, tileId: (i + l * 11) % 256 } : 0;
    }
    const factor = parallax && l > 0 ? { parallaxx: 1 + l / 10, parallaxy: 1 + l / 10 } : {};
    layers.push({ name: 'layer ' + l, tiles, ...factor });
  }
  return createMap({
    width: SIZE, height: SIZE, tilewidth: TILE, tileheight: TILE,
    tilesets: [{
      name: 'atlas', image: 'atlas.png', imagewidth: 16 * TILE, imageheight: 16 * TILE,
      tilewidth: TILE, tileheight: TILE, columns: 16, tilecount: 256
    }],
    layers
  });
}

function countQuads(container) {
  let quads = 0;
  (function walk(node) {
    if (node.geometry && node.geometry.positions) quads += node.geometry.positions.length / 8;
    for (const child of node.children) walk(child);
  })(container);
  return quads;
}

async function run() {
  const app = new Application();
  await app.init({ ...VIEW, preference: 'webgl', antialias: false, autoStart: false });
  document.body.appendChild(app.canvas);

  const gl = app.renderer.gl;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const glRenderer = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);

  const textures = new Map([['atlas.png', makeAtlas()]]);
  const span = { x: SIZE * TILE - VIEW.width, y: SIZE * TILE - VIEW.height };
  let quads = 0;

  /** Times one camera path over a fresh map; 'renderGroups' false switches them all off. */
  function measure(data, renderGroups, move) {
    const map = new TiledMap(data, { tilesetTextures: textures });
    if (!renderGroups) {
      (function off(node) {
        node.isRenderGroup = false;
        for (const child of node.children) off(child);
      })(map);
    }
    quads = countQuads(map);
    app.stage.addChild(map);

    for (let f = 0; f < WARMUP; f++) {
      move(map, f);
      app.render();
      gl.finish();
    }
    const start = performance.now();
    for (let f = 0; f < FRAMES; f++) {
      move(map, WARMUP + f);
      app.render();
      gl.finish();
    }
    const perFrame = (performance.now() - start) / FRAMES;

    app.stage.removeChild(map);
    map.destroy({ children: true });
    return perFrame;
  }

  const pan = (map, f) => map.position.set(-((f * 7) % span.x), -((f * 3) % span.y));
  const panZoom = (map, f) => {
    pan(map, f);
    map.scale.set(1 + 0.25 * Math.sin(f / 20));
  };
  const parallax = (map, f) => {
    pan(map, f);
    map.applyParallax(-map.x, -map.y);
  };

  const plain = makeMapData(false);
  const layered = makeMapData(true);
  const scenes = [
    ['still camera', plain, () => {}],
    ['pan', plain, pan],
    ['pan and zoom', plain, panZoom],
    ['pan with parallax layers', layered, parallax]
  ].map(([name, data, move]) => ({
    name,
    without: measure(data, false, move),
    with: measure(data, true, move)
  }));

  return { glRenderer, mapSize: SIZE, layers: LAYERS, frames: FRAMES, quads, scenes };
}
`
}
