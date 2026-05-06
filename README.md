# pixi-tiledmap v2 [![NPM version][npm-image]][npm-url]

Load and render [Tiled Map Editor](http://www.mapeditor.org/) maps with [PixiJS v8](https://pixijs.com/).

**v2** is a ground-up rewrite targeting PixiJS v8, with its own Tiled JSON and TMX XML parser (no external deps), full layer-type support, typed API, and ESM/CJS dual output.

## Features

- **PixiJS v8** — uses the modern `Assets` / `LoadParser` extension system
- **Tiled JSON + TMX XML** — full spec coverage (Tiled 1.11), both `.tmj` and `.tmx` formats
- **All layer types** — tile, image, object, and group layers
- **All orientations** — orthogonal, isometric, staggered, hexagonal
- **Render order** — right-down, right-up, left-down, left-up
- **Infinite maps** — chunk-based tile layer rendering
- **Tile features** — animated tiles, flip/rotation flags, image-collection tilesets, tint color, tile offset, `tilerendersize` / `fillmode`
- **Object rendering** — rectangles, ellipses, polygons, polylines, points, text (with underline/strikeout), tile objects
- **Object templates** — automatic `.tx` / `.tj` resolution with gid remapping between template and map tileset spaces
- **Parallax scrolling** — per-layer `parallaxx` / `parallaxy` and map-level `parallaxorigin`, composed multiplicatively through group layers, applied via `TiledMap.applyParallax(cameraX, cameraY)`
- **Data encoding** — CSV (both `.tmx` and `.tmj`) and base64 (uncompressed, gzip, zlib)
- **External tilesets** — automatic resolution via the asset loader (`.tsj` and `.tsx`)
- **Tree-shakable** — ESM + CJS dual build, side-effect-free
- **Typed** — comprehensive TypeScript types for the full Tiled spec

<<<<<<< ours
<<<<<<< ours
> **Notes on Tiled-spec coverage.** `zstd`-compressed tile data is not supported — the browser's `DecompressionStream` API only exposes `gzip` and `deflate`, and this library intentionally ships with zero runtime dependencies. Wang sets and terrains are parsed and exposed on `ResolvedTileset` for introspection, but they are editor-only metadata with no runtime rendering behaviour.
=======
=======
>>>>>>> theirs
## Modernization Check (v2.0.0)

v2.0.0 is modernized for the current PixiJS ecosystem and modern TypeScript package distribution:

- Targets **PixiJS v8** via `peerDependencies` (`pixi.js: ^8.0.0`)
- Ships **ESM + CJS + TypeScript types** through the `exports` map (`import` + `require`)
- Uses **native LoadParser integration** (`tiledMapLoader`) instead of legacy global loader APIs
- Declares **side-effect-free** package metadata (`"sideEffects": false`) for tree-shaking
- Uses a modern toolchain (`typescript`, `eslint` v9, `prettier` v3, `vitest`, `tsup`)

## Why this package stands out

- **Complete Tiled coverage in one package**: JSON + TMX, all layer types, all map orientations.
- **PixiJS-native loading path**: register once via `extensions.add(tiledMapLoader)` and load maps through `Assets`.
- **Performance-minded internals**: chunked infinite-layer rendering, cached tile textures, and efficient GID→tileset resolution.
- **Production packaging**: side-effect-free metadata, ESM/CJS dual output, and bundled type definitions.

## Optimization checklist (for app integrators)

If you want the best runtime behavior in your game/application:

- Prefer `.tmj` for the fastest parse path when authoring allows it.
- Preload map, tileset, and image assets with `Assets` before scene transitions.
- Reuse `TiledMap` instances for frequently revisited scenes when possible.
- Keep large worlds in infinite/chunked maps to avoid over-allocating one giant layer.
- Avoid unnecessary texture churn; pass stable texture maps into `TiledMap` options.
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

## Installation

```sh
npm install pixi-tiledmap pixi.js
```

## Quick Start — Asset Loader (recommended)

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

## API Reference

### Exports

| Export                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `tiledMapLoader`      | PixiJS `LoadParser` extension — register with `extensions.add()` |
| `TiledMap`            | `Container` subclass that renders a resolved map                 |
| `TileLayerRenderer`   | `Container` for a single tile layer                              |
| `ImageLayerRenderer`  | `Container` for a single image layer                             |
| `ObjectLayerRenderer` | `Container` for a single object layer                            |
| `GroupLayerRenderer`  | `Container` for a group layer (recursive)                        |
| `TileSetRenderer`     | Texture manager for a tileset                                    |
| `parseMap(data)`      | Synchronous Tiled JSON → resolved IR                             |
| `parseMapAsync(data)` | Async variant (required for gzip/zlib compressed data)           |
| `parseTmx(xml)`       | Parse TMX XML string → `TiledMap` data (same shape as JSON)      |
| `parseTsx(xml)`       | Parse TSX XML string → `TiledTileset` data                       |
| `parseTx(xml)`        | Parse TX XML string → `TiledObjectTemplate` data                 |
| `decodeGid(raw)`      | Decode a raw GID into tile ID + flip flags                       |

### `TiledMap` Container

```ts
const map = new TiledMap(resolvedMap, {
  tilesetTextures, // Map<imagePath, Texture>
  imageLayerTextures, // Map<imagePath, Texture>
  tileImageTextures, // Map<imagePath, Texture> (image-collection tiles)
});

map.orientation; // 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal'
map.mapWidth; // tile columns
map.mapHeight; // tile rows
map.tileWidth; // tile pixel width
map.tileHeight; // tile pixel height
map.getLayer('ground'); // find layer Container by name

// Parallax: call after moving your camera each frame. Layers with
// parallaxx/parallaxy < 1 move slower than the camera; layers with
// parallax 0 are pinned in screen space. Group-layer parallax composes
// multiplicatively with its children.
map.applyParallax(camera.x, camera.y);
```

### Object Templates

When loading through the asset loader, any object with a `template` field
is resolved automatically — referenced `.tx` / `.tj` files are fetched in
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
npm test             # Vitest
```

[npm-url]: https://npmjs.org/package/pixi-tiledmap
[npm-image]: http://img.shields.io/npm/v/pixi-tiledmap.svg?style=flat
