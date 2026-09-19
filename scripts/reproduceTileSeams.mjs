/**
 * Visual integration repro for atlas seams under a fractional device transform.
 *
 * Run `npm run build && npm run reproduce:tile-seams`, open the printed URL in
 * Chrome on a 1.25 DPR display, and keep the browser content area 2468 CSS px
 * wide. Query parameters `x`, `y`, `scale`, and `padding` allow comparisons.
 * The map assets are fetched from the public pixi-tiledmap-viewer asset host;
 * this is a manual repro, not an offline or CI test.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const nodeModules = resolve(root, 'node_modules')

if (!existsSync(resolve(dist, 'index.mjs'))) {
  throw new Error('dist/index.mjs is missing; run npm run build first.')
}

const pixiNames = [
  'AnimatedSprite',
  'Application',
  'Assets',
  'CanvasSource',
  'CanvasTextGenerator',
  'CanvasTextMetrics',
  'Container',
  'DOMAdapter',
  'ExtensionType',
  'Graphics',
  'Matrix',
  'Mesh',
  'MeshGeometry',
  'Rectangle',
  'Sprite',
  'Text',
  'Texture',
  'Ticker',
  'TilingSprite',
  'extensions',
  'path'
]

const exactRoutes = new Map([
  ['/', (response) => send(response, page(), 'text/html; charset=utf-8')],
  [
    '/shims/pixi.mjs',
    (response) =>
      send(
        response,
        `const P=globalThis.PIXI;${pixiNames.map((name) => `export const ${name}=P.${name};`).join('')}`,
        'text/javascript; charset=utf-8'
      )
  ],
  [
    '/shims/pixi-gif.mjs',
    (response) =>
      send(
        response,
        'const P=globalThis.PIXI; export const {GifAsset,GifSprite}=P;',
        'text/javascript; charset=utf-8'
      )
  ],
  ['/shims/advanced.mjs', (response) => send(response, '', 'text/javascript')]
])
const fileRoutes = [
  { prefix: '/dist/', base: dist },
  { prefix: '/node_modules/', base: nodeModules }
]
const contentTypes = new Map([
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript']
])

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  const exact = exactRoutes.get(pathname)
  if (exact) return exact(response)

  const route = fileRoutes.find((candidate) => pathname.startsWith(candidate.prefix))
  if (!route) return notFound(response)
  sendFile(response, route.base, pathname.slice(route.prefix.length))
})

server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  console.log(`Open http://127.0.0.1:${address.port}/ and press Ctrl+C when done.`)
})

function sendFile(response, base, requestedPath) {
  const file = resolveServedFile(base, requestedPath)
  if (!file) return notFound(response)
  send(response, readFileSync(file), contentTypes.get(extname(file)))
}

function resolveServedFile(base, requestedPath) {
  const file = resolve(base, decodeURIComponent(requestedPath))
  if (relative(base, file).startsWith('..')) return null
  if (!existsSync(file)) return null
  return file
}

function notFound(response) {
  response.writeHead(404)
  response.end('Not found')
}

function send(response, body, contentType = 'application/octet-stream') {
  response.writeHead(200, { 'content-type': contentType })
  response.end(body)
}

function page() {
  return `<!doctype html>
<meta charset="utf-8">
<style>
  html,body{margin:0;width:2468px;height:900px;overflow:hidden;background:#e32ff4}
  canvas{display:block;width:2468px;height:900px}
  #status{position:fixed;z-index:1;left:8px;top:8px;padding:6px 8px;background:#000c;color:#fff;font:12px monospace}
</style>
<div id="status">loading...</div>
<script src="/node_modules/pixi.js/dist/pixi.js"></script>
<script src="/node_modules/pixi.js/dist/packages/gif.js"></script>
<script type="importmap">{"imports":{"pixi.js":"/shims/pixi.mjs","pixi.js/gif":"/shims/pixi-gif.mjs","pixi.js/advanced-blend-modes":"/shims/advanced.mjs"}}</script>
<script type="module">
import {Application,Container} from 'pixi.js';
import {loadTiledMapAsset} from '/dist/index.mjs';

const status=document.querySelector('#status');
try {
  const params=new URLSearchParams(location.search);
  const padding=Number(params.get('padding')??'0.01');
  const cameraX=Number(params.get('x')??'-430');
  const cameraY=Number(params.get('y')??'-1470');
  const scale=Number(params.get('scale')??'1');
  const app=new Application();
  await app.init({width:2468,height:900,resolution:devicePixelRatio,autoDensity:true,antialias:false,background:'#e32ff4'});
  document.body.appendChild(app.canvas);
  const {container}=await loadTiledMapAsset(
    'https://tilemaps.theriebel.de/v2/maps/evol/maps/008-1-1.tmx',
    {mapOptions:{tileSpritePadding:padding}}
  );
  for(const name of ['Collision','Heights','Objects']){
    const layer=container.getLayer(name);
    if(layer) layer.visible=false;
  }
  const world=new Container();
  world.position.set(cameraX,cameraY);
  world.scale.set(scale);
  world.addChild(container);
  app.stage.addChild(world);
  app.renderer.render(app.stage);
  status.textContent='DPR '+devicePixelRatio+' | canvas '+app.canvas.width+'x'+app.canvas.height+' | x '+cameraX+' | scale '+scale+' | padding '+padding;
} catch(error) {
  status.textContent=String(error?.stack??error);
}
</script>`
}
