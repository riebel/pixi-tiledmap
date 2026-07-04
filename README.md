# pixi-tiledmap v2 [![NPM version][npm-image]][npm-url]

Load and render [Tiled Map Editor](http://www.mapeditor.org/) maps with [PixiJS v8](https://pixijs.com/).

**v2** is a ground-up rewrite targeting PixiJS v8, with its own Tiled JSON and TMX XML parser (no external deps), full layer-type support, typed API, and ESM/CJS dual output.

## Features

- **PixiJS v8** - uses the modern `Assets` / `LoadParser` extension system
- **Tiled JSON + TMX XML** - full spec coverage (Tiled 1.11), both `.tmj` and `.tmx` formats
- **All layer types** - tile, image, object, and group layers
- **All orientations** - orthogonal, isometric, staggered, hexagonal
- **Render order** - right-down, right-up, left-down, left-up
- **Infinite maps** - chunk-based tile layer rendering
- **Packed tile layers** - static map tiles render as PixiJS batchable mesh geometry grouped by texture source and alpha, with large source-inspired batches and no external tilemap dependency
- **Partial tile updates** - same-atlas runtime tile edits update packed mesh buffers in place; structural changes safely rebuild the affected tile layer
- **Tile features** - animated tiles, flip/rotation flags, image-collection tilesets, tint color, tile offset, runtime tile alpha, `tilerendersize` / `fillmode`
- **Object rendering** - rectangles, ellipses, polygons, polylines, points, text (with underline/strikeout), tile objects
- **Object templates** - automatic `.tx` / `.tj` resolution with gid remapping between template and map tileset spaces
- **Parallax scrolling** - per-layer `parallaxx` / `parallaxy` and map-level `parallaxorigin`, composed multiplicatively through group layers, applied via `TiledMap.applyParallax(cameraX, cameraY)`
- **Data encoding** - CSV (both `.tmx` and `.tmj`) and base64 (uncompressed, gzip, zlib)
- **External tilesets** - automatic resolution via the asset loader (`.tsj` and `.tsx`)
- **Runtime editing and generation** - edit loaded maps in place or create resolved maps procedurally
- **Parser defaulting** - sparse TMJ/JSON input is normalized with Tiled-compatible defaults before rendering
- **Tree-shakable** - ESM + CJS dual build, side-effect-free
- **Typed** - comprehensive TypeScript types for the full Tiled spec

> **Notes on Tiled-spec coverage.** `zstd`-compressed tile data is not supported - the browser's `DecompressionStream` API only exposes `gzip` and `deflate`, and this library intentionally ships with zero runtime dependencies. Wang sets and terrains are parsed and exposed on `ResolvedTileset` for introspection, but they are editor-only metadata with no runtime rendering behaviour.

## Modernization Check (v2.0.0)

v2.0.0 is modernized for the current PixiJS ecosystem and modern TypeScript package distribution:

- Targets **PixiJS v8** via `peerDependencies` (`pixi.js: >=8.7.0`)
- Ships **ESM + CJS + TypeScript types** through the `exports` map (`import` + `require`)
- Uses **native LoadParser integration** (`tiledMapLoader`) instead of legacy global loader APIs
- Declares **side-effect-free** package metadata (`"sideEffects": false`) for tree-shaking
- Uses a modern toolchain (`typescript`, `biome`, `vitest`, `tsdown`)

## Why this package stands out

- **Complete Tiled coverage in one package**: JSON + TMX, all layer types, all map orientations.
- **PixiJS-native loading path**: register once via `extensions.add(tiledMapLoader)` and load maps through `Assets`.
- **Performance-minded internals**: batchable packed mesh-backed tile layers, cached quad indices, partial packed mesh updates for same-atlas/same-alpha tile edits, chunked infinite-layer traversal, cached tile textures, and efficient GID→tileset resolution.
- **Composable renderer pipeline**: layer filtering, parallax, tile visuals, and texture loading are factored so manual and loader-based usage share the same rendering behavior.
- **Production packaging**: side-effect-free metadata, ESM/CJS dual output, and bundled type definitions.

## Internal Model

The library keeps three concepts separate:

- **Tiled map data**: TMJ JSON or TMX XML in the shape Tiled writes.
- **Resolved map IR**: normalized data with Tiled-compatible defaults applied, external tilesets supplied, templates merged, GIDs decoded, and layer data decoded.
- **PixiJS rendering**: a `TiledMap` container built from a resolved map, texture maps, layer tree rendering, packed tile meshes, tile visuals for object/animated cases, and map geometry.

The asset loader runs the complete pipeline for `.tmj` and `.tmx` files. Manual construction gives you the same pieces directly: parse to a resolved map, load textures, then construct `TiledMap`.

Procedural construction starts at the same **Resolved map IR** boundary. Maps created with `createMap` render through the same `TiledMap` container and support the same runtime editing methods as loaded maps.

TMJ/JSON maps may omit fields whose values match Tiled defaults. `parseMap` and `parseMapAsync` normalize those omissions when building the resolved map: map defaults such as `orientation`, `renderorder`, `infinite`, and parallax origins; layer defaults such as `opacity`, `visible`, offsets, parallax, and properties; object defaults such as empty `name` / `type`, zero size, zero rotation, and visible state; and tileset defaults such as margin, spacing, computed columns, tile offset, render size, fill mode, object alignment, and properties.

## Optimization checklist (for app integrators)

If you want the best runtime behavior in your game/application:

- Prefer `.tmj` for the fastest parse path when authoring allows it.
- Preload map, tileset, and image assets with `Assets` before scene transitions.
- Reuse `TiledMap` instances for frequently revisited scenes when possible.
- Keep large worlds in infinite/chunked maps to avoid over-allocating one giant layer.
- Avoid unnecessary texture churn; pass stable texture maps into `TiledMap` options.
- Keep the default `tileMeshBatchSize` unless you are profiling a GPU/driver that prefers smaller meshes; the default keeps packed meshes below 16-bit index limits while reducing render object count.
- Treat `TileLayerRenderer.children` as renderer internals. Static map tiles are usually `Mesh` children now, not one `Sprite` per tile.
- Run `npm run bench` before and after renderer hot-path changes if you maintain a fork.
- `npm test` includes a headless MagicLand visual regression that renders a real TMX + GIF tileset fixture and pixel-compares it against a checked-in reference image.

## Installation

```sh
npm install pixi-tiledmap pixi.js
```

## Quick Start - Asset Loader (recommended)

Register the loader extension once, then load `.tmj` (JSON) or `.tmx` (XML) files through `Assets`:

```ts
import { Application, extensions, Assets } from 'pixi.js';
import { tiledMapLoader } from 'pixi-tiledmap';

extensions.add(tiledMapLoader);

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

const { container } = await Assets.load('assets/map.tmj');
app.stage.addChild(container);
```

> The loader auto-detects the format by file extension: `.tmj` → JSON, `.tmx` → XML.

## Manual Construction

If you prefer to parse and build the display tree yourself:

```ts
import { parseMap, TiledMap } from 'pixi-tiledmap';
import { Assets, Texture } from 'pixi.js';
import type { TiledMap as TiledMapData } from 'pixi-tiledmap';

const response = await fetch('assets/map.tmj');
const data: TiledMapData = await response.json();

const mapData = parseMap(data);

const tilesetTextures = new Map<string, Texture>();
for (const ts of mapData.tilesets) {
  if (ts.image) {
    tilesetTextures.set(ts.image, await Assets.load(ts.image));
  }
}

const container = new TiledMap(mapData, { tilesetTextures });
app.stage.addChild(container);
```

For image layers, image-collection tilesets, and animated GIF sources, pass the corresponding texture maps through `TiledMapOptions`. The asset loader fills these maps automatically.

## Runtime Editing and Procedural Maps

Use `setTile`, `getTile`, and `clearTile` to update rendered tile layers by layer name or numeric layer id:

```ts
// Load save data and swap a chest tile.
map.setTile('chests', 12, 8, { tileset: 'dungeon', tileId: save.chestOpen ? 5 : 4 });
```

For static packed tiles, edits that stay on the same texture source and alpha group update the existing packed mesh geometry buffers in place. Unchanged rect/UV edits skip buffer uploads. Clearing a packed tile degenerates its quad without replacing the mesh. Edits that add a previously empty tile, switch texture sources or alpha groups, or change between packed tiles and sprite-backed tiles such as animations or GIFs rebuild the affected tile layer automatically.

Use `createMap` for generated maps. It returns the same resolved map shape as `parseMap`, so the rendered result supports the same editing API:

```ts
import { createMap, TiledMap } from 'pixi-tiledmap';

const generated = createMap({
  width: 40,
  height: 24,
  tilewidth: 16,
  tileheight: 16,
  tilesets: [
    {
      name: 'dungeon',
      image: 'dungeon.png',
      imagewidth: 256,
      tilewidth: 16,
      tileheight: 16,
      tilecount: 128,
    },
  ],
  layers: [
    {
      name: 'floor',
      tiles: floorTiles.map((tileId) => ({ tileset: 'dungeon', tileId })),
    },
    {
      name: 'details',
      tiles: new Array(40 * 24).fill(null),
    },
  ],
});

const map = new TiledMap(generated, { tilesetTextures });
map.setTile('details', 10, 6, { tileset: 'dungeon', tileId: 42 });
```

## API Reference

### Exports

| Export                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `tiledMapLoader`      | PixiJS `LoadParser` extension - register with `extensions.add()` |
| `TiledMap`            | `Container` subclass that renders a resolved map                 |
| `TileLayerRenderer`   | Packed mesh-backed `Container` for a single tile layer           |
| `ImageLayerRenderer`  | `Container` for a single image layer                             |
| `ObjectLayerRenderer` | `Container` for a single object layer                            |
| `GroupLayerRenderer`  | `Container` for a group layer (recursive)                        |
| `PackedTileLayerRenderer` | Packed mesh base used by `TileLayerRenderer`, with a low-level `addTextureRect()` seam |
| `TileSetRenderer`     | Texture manager for a tileset                                    |
| `createMap(options)`  | Create a resolved map procedurally                               |
| `createTileset(options)` | Create a resolved tileset                                     |
| `createTileLayer(options, tilesets?)` | Create a resolved tile layer                    |
| `createImageLayer(options)` | Create a resolved image layer                              |
| `createObjectLayer(options)` | Create a resolved object layer                          |
| `createGroupLayer(options, tilesets?)` | Create a resolved group layer                  |
| `parseMap(data)`      | Synchronous Tiled JSON → resolved IR                             |
| `parseMapAsync(data)` | Async variant (required for gzip/zlib compressed data)           |
| `parseTmx(xml)`       | Parse TMX XML string → `TiledMap` data (same shape as JSON)      |
| `parseTsx(xml)`       | Parse TSX XML string → `TiledTileset` data                       |
| `parseTx(xml)`        | Parse TX XML string → `TiledObjectTemplate` data                 |
| `decodeGid(raw)`      | Decode a raw GID into tile ID + flip flags                       |

#### XML parsing outside the browser

`parseTmx`, `parseTsx`, and `parseTx` parse XML through PixiJS' `DOMAdapter`, so they work in browsers, web workers, and Node. In the browser the default adapter is used automatically. In a web worker or in Node there is no global `DOMParser`, so configure a DOM-capable adapter once at startup before parsing:

```ts
import { DOMAdapter, WebWorkerAdapter } from 'pixi.js'

DOMAdapter.set(WebWorkerAdapter) // uses @xmldom/xmldom under the hood
```

### Low-Level Packing

`PackedTileLayerRenderer.addTextureRect()` is available for renderer-level integrations that need to pack an already-resolved texture rectangle without going through Tiled tile placement. It uses the same batch sizing, texture-source/alpha grouping, cached quad indices, and final `MeshGeometry` path as normal tile layers.

Most applications should use `TiledMap` and `TileLayerRenderer`; the low-level seam exists for renderer extensions and focused tests.

### `TiledMap` Container

```ts
const map = new TiledMap(resolvedMap, {
  tilesetTextures, // Map<imagePath, Texture>
  imageLayerTextures, // Map<imagePath, Texture>
  tileImageTextures, // Map<imagePath, Texture> (image-collection tiles)
  tileImageGifSources, // Map<imagePath, GifSource> (animated image-collection tiles)
  imageLayerGifSources, // Map<imagePath, GifSource> (animated image layers)
  layerFilter, // optional (layer) => boolean, for rendering selected layers
  tileSpritePadding, // optional, defaults to 0.01 to hide fractional-scale seams
  tileMeshBatchSize, // optional, defaults to 16000 quads per packed mesh
});

map.orientation; // 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal'
map.mapWidth; // tile columns
map.mapHeight; // tile rows
map.tileWidth; // tile pixel width
map.tileHeight; // tile pixel height
map.getLayer('ground'); // find layer Container by name

// Runtime tile editing. Layer can be a tile-layer name or numeric layer id.
map.getTile('ground', 12, 8);
map.setTile('ground', 12, 8, 42); // raw Tiled GID
map.setTile('ground', 12, 8, { tileset: 'dungeon', tileId: 4 });
map.setTile('ground', 12, 8, { tileset: 'dungeon', tileId: 4, alpha: 0.5 });
map.clearTile('ground', 12, 8);

// Parallax: call after moving your camera each frame. Layers with
// parallaxx/parallaxy < 1 move slower than the camera; layers with
// parallax 0 are pinned in screen space. Group-layer parallax composes
// multiplicatively with its children.
map.applyParallax(camera.x, camera.y);
```

To split a map around a player sprite, render the same resolved map twice with
different layer filters:

```ts
const isOverhead = (layer: ResolvedLayer) =>
  layer.properties.some((prop) => prop.name === 'overhead' && prop.value === true);

const belowPlayer = new TiledMap(resolvedMap, {
  tilesetTextures,
  layerFilter: (layer) => !isOverhead(layer),
});

const abovePlayer = new TiledMap(resolvedMap, {
  tilesetTextures,
  layerFilter: isOverhead,
});
```

### Object Templates

When loading through the asset loader, any object with a `template` field
is resolved automatically - referenced `.tx` / `.tj` files are fetched in
parallel and merged into the map before rendering.

For manual construction (`parseMap` / `parseMapAsync`), pass templates via
`ParseOptions.templates`:

```ts
import { parseMap, parseTx } from 'pixi-tiledmap';

const templates = new Map();
templates.set('sign.tx', parseTx(await (await fetch('sign.tx')).text()));

const mapData = parseMap(data, { externalTilesets, templates });
```

Template-instance merging follows Tiled semantics: the template's object
fields are the base, and the instance overrides any field it explicitly
sets (name, type, size, properties, gid, shape). If the template carries
an external-tileset reference whose `source` also exists in the map,
`gid` is translated from the template firstgid-space to the map
firstgid-space, preserving flip flags.

## Migration from v1

| v1 (PixiJS v4)                        | v2 (PixiJS v8)                                           |
| ------------------------------------- | -------------------------------------------------------- |
| `PIXI.loader.add('map.tmx').load(…)`  | `extensions.add(tiledMapLoader); Assets.load('map.tmj')` |
| `new PIXI.extras.TiledMap('map.tmx')` | `const { container } = await Assets.load('map.tmj')`     |
| Global namespace mutation             | Named ESM imports                                        |
| TMX XML via `tmx-parser`              | Built-in JSON + XML parser (no external deps)            |
| Tile + image layers only              | All layer types                                          |

## Development

```sh
npm install
npm run build        # ESM + CJS + types via tsdown
npm run dev          # watch mode
npm run check        # Biome lint + format
npm run typecheck    # tsc --noEmit
npm test             # Build, Vitest, and MagicLand visual regression
npm run bench        # renderer hot-path benchmarks
```

Benchmark guidance and the current smoke baseline live in [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md).

[npm-url]: https://npmjs.org/package/pixi-tiledmap
[npm-image]: http://img.shields.io/npm/v/pixi-tiledmap.svg?style=flat
