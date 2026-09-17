# pixi-tiledmap [![NPM version][npm-image]][npm-url]

Load, render, edit, generate, and export [Tiled Map Editor](https://www.mapeditor.org/) maps with [PixiJS v8](https://pixijs.com/).

The library ships its own Tiled JSON and TMX XML parser with no runtime dependencies, supports every layer type and map orientation, and is fully typed.

## Features

- **PixiJS v8** - integrates through the `Assets` / `LoadParser` extension system
- **Tiled JSON + TMX XML** - full spec coverage (Tiled 1.11, plus the 1.12 additions below), both `.tmj` and `.tmx` formats, which parse to identical data - including `object`, `class` and `list` custom properties
- **All layer types** - tile, image, object, and group layers
- **All orientations** - orthogonal, isometric, staggered, hexagonal, and Tiled 1.12 oblique (`skewx` / `skewy`)
- **Render order** - right-down, right-up, left-down, left-up
- **Infinite maps** - chunk-based tile layer rendering
- **Packed tile layers** - static map tiles render as PixiJS batchable mesh geometry grouped by texture source and alpha without changing draw order, with large source-inspired batches and no external tilemap dependency
- **Incremental tile edits** - runtime tile edits update packed mesh buffers in place, and painting into empty cells reuses freed quad slots or grows batch capacity; edits that cannot be written in place rebuild the affected tile layer
- **Tile features** - animated tiles, flip/rotation flags, image-collection tilesets (including Tiled 1.9 image sub-rectangles), tint color, tile offset, runtime tile alpha, `tilerendersize` / `fillmode`, `transparentcolor` color keys on tilesets and image layers
- **Layer blend modes** - Tiled 1.12 `mode` maps onto the container's PixiJS `blendMode`; PixiJS' advanced blend modes are loaded on demand for maps that use them
- **Object rendering** - rectangles, ellipses, capsules, polygons, polylines, points, text (aligned and clipped to its box, with underline/strikeout), and tile objects (animated, placed by `objectalignment`, rotated around their origin), in `topdown` or `index` draw order and projected on isometric and oblique maps like in Tiled
- **Object templates** - automatic `.tx` / `.tj` resolution following Tiled's inheritance rules, with gid remapping between template and map tileset spaces
- **Parallax scrolling** - per-layer `parallaxx` / `parallaxy` and map-level `parallaxorigin`, composed multiplicatively through group layers, applied via `TiledMap.applyParallax(cameraX, cameraY)`
- **Data encoding** - CSV (both `.tmx` and `.tmj`) and base64 (uncompressed, gzip, zlib), read and written
- **Asset lifecycle** - loaded maps follow the PixiJS `Assets` cache: `Assets.unload` destroys the map, and a destroyed map is rebuilt on the next load
- **External tilesets** - automatic resolution via the asset loader (`.tsj` and `.tsx`)
- **Runtime editing and generation** - edit loaded maps in place or create resolved maps procedurally, with tile objects taking the same friendly tile input as tile layer cells
- **Map export** - `exportMap` / `exportMapAsync` write a resolved map back to Tiled JSON, keeping each tile layer's encoding and (async) its gzip/zlib compression, and `exportTileset` writes a standalone `.tsj`, so a generated map opens in Tiled; parsing an exported map reproduces the same map exactly
- **Map introspection** - `findLayer`, `getProperty`, and `tileAt` (point to tile cell, every orientation) work on the resolved map without a renderer, free of PixiJS and the DOM
- **Parser defaulting** - sparse TMJ/JSON input is normalized with Tiled-compatible defaults before rendering
- **Tree-shakable** - ESM + CJS builds with one module per source file and included type definitions; the parser, map export, procedural maps, lookups, and map geometry bundle without PixiJS
- **Typed** - comprehensive TypeScript types for the full Tiled spec

> **Notes on Tiled-spec coverage.** `zstd`-compressed tile data is not supported - the browser's `DecompressionStream` API only exposes `gzip` and `deflate`, and this library intentionally ships with zero runtime dependencies. Wang sets and terrains (including the pre-1.5 TMX format) are parsed and exposed on `ResolvedTileset` for introspection, but they are editor-only metadata with no runtime rendering behaviour. Tiled's hexagonal tile turns (the diagonal-flip bit as 60°, the extra bit as 120°) render as sprites rather than packed quads.

## Requirements

- `pixi.js` `>=8.10.0` as a peer dependency
- A runtime with the Compression Streams API for gzip/zlib tile data (`parseMapAsync`, `exportMapAsync`); every current browser and Node 18+ provides it

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
- Treat `TileLayerRenderer.children` as renderer internals. Static map tiles are packed into `Mesh` children, not one `Sprite` per tile.
- Display objects you add to a `TileLayerRenderer` (for example a player walking on that layer) survive tile edits and layer rebuilds and keep their position relative to the tiles. Tiles sit below children you add, unless you insert yours below them with `addChildAt`. Destroying the map with its children, or unloading it, destroys them too.

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
> Image paths inside external TSJ/TSX tilesets are resolved relative to the
> tileset file, matching Tiled's path semantics even when tilesets live in a
> nested directory. External tileset paths inside object templates are likewise
> resolved relative to the template file so template tile GIDs map correctly.

> PixiJS caches loaded assets, so loading the same map URL again returns the
> **same** `container`, not a copy. To render one map twice (for example below
> and above the player), construct separate `TiledMap`s with `layerFilter`, as
> shown in the [`TiledMap` container](#tiledmap-container) section. Once the
> container has been destroyed, the next `Assets.load` returns a freshly built
> one from the cached map data and textures; the rebuild happens synchronously
> the first time `container` is read. That rebuild reuses the loaded textures,
> so do not destroy the container with `{ textureSource: true }` if you load the
> map again. `Assets.unload(url)` destroys the current container and its
> children, including display objects you added to its layers; remove those
> first if you still need them. Textures and GIF sources stay in the `Assets`
> cache.

> GIF sprites created by the map never destroy their `GifSource`, not even with
> `destroy(true)`, because other maps may share it. Call `source.destroy()`
> yourself to free one. A `clone()` of such a sprite is a plain PixiJS
> `GifSprite`: `clone.destroy(true)` does destroy the shared source, so destroy
> clones without arguments.

Renderer options can be supplied through Pixi's asset metadata:

```ts
const { container } = await Assets.load({
  src: 'assets/map.tmj',
  data: {
    mapOptions: {
      tileMeshBatchSize: 16_000,
      layerFilter: (layer) => layer.visible
    }
  }
});
```

The loader switches every texture it loads to `nearest` scaling, so pixel-art
tiles stay sharp and neighbouring atlas cells do not bleed into visible lines
when the map is zoomed. The textures are shared through the `Assets` cache, so
this applies to other users of the same images too. Pass `scaleMode: 'linear'`
for smooth filtering, or `scaleMode: null` to leave each texture as it is:

```ts
const { container } = await Assets.load({
  src: 'assets/map.tmj',
  data: { scaleMode: 'linear' }
});
```

Antialiasing is a renderer setting; pass `antialias: false` to
`Application.init` for crisp tile edges.

Or call the same asset pipeline directly when custom fetch or asset-loading
adapters are needed. The returned `container` is typed as `TiledMap`, so its
layer, parallax, and tile-editing APIs are available without a cast:

```ts
import { loadTiledMapAsset } from 'pixi-tiledmap';

const { container } = await loadTiledMapAsset('assets/map.tmj', {
  mapOptions: {
    tileSpritePadding: 0.01,
    tileMeshBatchSize: 16_000,
    layerFilter: (layer) => layer.visible
  }
});

container.applyParallax(cameraX, cameraY);
container.setTile('details', 10, 6, { tileset: 'dungeon', tileId: 42 });
```

## Manual Construction

If you prefer to parse and build the display tree yourself:

```ts
import { parseMap, TiledMap } from 'pixi-tiledmap';
import type { TiledMapData } from 'pixi-tiledmap';
import { Assets, type Texture } from 'pixi.js';

const response = await fetch('assets/map.tmj');
const data: TiledMapData = await response.json();

const mapData = parseMap(data);

const tilesetTextures = new Map<string, Texture>();
for (const ts of mapData.tilesets) {
  if (ts.image) {
    // Image paths are relative to the map file; the map key stays unchanged.
    tilesetTextures.set(ts.image, await Assets.load(`assets/${ts.image}`));
  }
}

const container = new TiledMap(mapData, { tilesetTextures });
app.stage.addChild(container);
```

For image layers, image-collection tilesets, and animated GIF sources, pass the corresponding texture maps through `TiledMapOptions`. The asset loader fills these maps automatically.

A map whose layers use advanced blend modes (`overlay`, `darken`, ...) needs PixiJS' advanced blend modes registered before it renders. The asset loader takes care of that; when constructing the map yourself, `await loadMapBlendModes(mapData)` before `new TiledMap(...)`. It resolves at once for maps that do not need it.

## Runtime Editing and Procedural Maps

Use `setTile`, `getTile`, and `clearTile` to update rendered tile layers by layer name or numeric layer id:

```ts
// Load save data and swap a chest tile.
map.setTile('chests', 12, 8, { tileset: 'dungeon', tileId: save.chestOpen ? 5 : 4 });
```

For static packed tiles, edits that stay on the same texture source and alpha group update the existing packed mesh geometry buffers in place. Unchanged rect/UV edits skip buffer uploads.

Painting a static tile into an empty cell is incremental as well: clearing a tile degenerates its quad and returns that slot to the layer, and a later insert reuses a freed slot before it grows batch capacity geometrically. Repeated clear/set cycles therefore reuse existing capacity and leave mesh count and buffer size unchanged. This applies to orthogonal maps whose tile quads stay inside their own grid cell, which is the common case; the renderer verifies that per tile. The default sub-pixel `tileSpritePadding` seam is allowed; a padding large enough to overlap neighbours visibly is not.

The following edits rebuild the affected tile layer, because their result cannot be reproduced by writing a single quad in place:

- inserting into a cell of an isometric, staggered, or hexagonal map, or of any layer whose tiles overhang their grid cell (via `tileoffset`, a tile larger than the grid, or a `tileSpritePadding` above `0.125`px), where the draw order of overlapping quads is significant
- switching an existing tile to a different texture source or alpha group
- changing between packed tiles and sprite-backed tiles: animated tiles, GIFs, and tiles a hexagonal map turns by 60 or 120 degrees
- inserting a tile whose tileset texture is not available

See [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) for how incremental editing works and what it costs.

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

For isometric, staggered, hexagonal, and oblique maps, set `orientation`. Staggered and hexagonal maps also take `staggeraxis`, `staggerindex`, and (hexagonal only) `hexsidelength`, and oblique maps `skewx` / `skewy`, as in a Tiled map file:

```ts
const hexMap = createMap({
  orientation: 'hexagonal',
  width: 20,
  height: 12,
  tilewidth: 60,
  tileheight: 70,
  hexsidelength: 35,
  staggeraxis: 'y',
  staggerindex: 'odd',
  // tilesets, layers ...
});
```

Tile objects accept the same tile input as tile layer cells, so the library derives the GID and tileset index rather than making you restate them:

```ts
layers: [
  {
    type: 'objectgroup',
    name: 'actors',
    objects: [
      // The tileset is named, so this keeps working if the tilesets are reordered.
      { id: 1, name: 'koopa', x: 32, y: 48, tile: { tileset: 'enemies', tileId: 12 } },
    ],
  },
],
```

## Writing Maps Back Out

`exportMap` is the inverse of `parseMap`: it turns a resolved map back into Tiled JSON, so a generated map can be saved as a `.tmj` and opened in Tiled. Parsing an exported map returns a map deep-equal to the one you exported.

```ts
import { exportMap, parseMap } from 'pixi-tiledmap';

const tmj = exportMap(generated);
await writeFile('level.tmj', JSON.stringify(tmj, null, 2));
```

A tileset is written as an external `{ firstgid, source }` reference when it has a `source` - as every externally-resolved tileset does - and embedded otherwise. Pass `tilesetSources` to externalise embedded tilesets by name:

```ts
const tmj = exportMap(generated, {
  tilesetSources: { dungeon: 'tilesets/dungeon.tsj' },
  encoding: 'base64', // 'csv' writes a plain GID array; default: each layer's own encoding
});
```

Each tile layer remembers whether it was base64 and how it was compressed, and `createTileLayer` accepts the same `encoding` / `compression` options. `exportMap` keeps the encoding but cannot compress; `exportMapAsync` also writes gzip or zlib through the Compression Streams API, so its output parses back with `parseMapAsync` to exactly the same map:

```ts
import { exportMapAsync } from 'pixi-tiledmap';

const kept = await exportMapAsync(parsed); // each layer keeps its compression
const gzipped = await exportMapAsync(generated, { compression: 'gzip' }); // or pick one; null for none
```

`exportTileset` writes a tileset the same way. By default it produces embedded map data; `{ standalone: true }` produces a `.tsj` file, which carries `type: 'tileset'` and no `firstgid` — the first global id belongs to the map that references the tileset, not to the file:

```ts
import { exportTileset } from 'pixi-tiledmap';

const ground = generated.tilesets.find((tileset) => tileset.name === 'dungeon')!;
await writeFile(
  'tilesets/dungeon.tsj',
  JSON.stringify(exportTileset(ground, { standalone: true, tiledversion: '1.11.2' }), null, 2)
);
```

That file reads straight back through `ParseOptions.externalTilesets`, which is typed `TiledTilesetFile` — a tileset without a `firstgid` — so a `.tsj` read from disk needs no cast:

```ts
import type { TiledTilesetFile } from 'pixi-tiledmap';

const dungeon: TiledTilesetFile = JSON.parse(await readFile('tilesets/dungeon.tsj', 'utf8'));
const map = parseMap(tmj, { externalTilesets: new Map([['tilesets/dungeon.tsj', dungeon]]) });
```

Two caveats worth knowing, since both are silent:

- `ResolvedTile.alpha` is a runtime render property with no place in the Tiled format, so it is not written. A GID carries no opacity.
- `exportMap` writes compressed layers as uncompressed base64, since the Compression Streams API has no synchronous form. Use `exportMapAsync` to keep the compression. zstd is neither read nor written.

`nextlayerid` and `nextobjectid` are kept from the parsed map and only ever raised, so ids of layers and objects deleted in Tiled are not handed out again.

## Inspecting a Map Without Rendering It

`findLayer`, `getProperty`, and `tileAt` work on the resolved map itself, so tools that transform a map before rendering do not need a `TiledMap` container. They are pure - no PixiJS, no DOM.

```ts
import { findLayer, getProperty, tileAt } from 'pixi-tiledmap';

const spawns = findLayer(mapData, 'spawns'); // searches nested group layers too
const theme = getProperty(mapData, 'theme', 'string'); // string | undefined

// Camera maths stays with you: convert a pointer event to the map container's local space first.
const local = map.toLocal(event.global);
const cell = tileAt(mapData, local.x, local.y); // null outside the map, never clamped
```

`tileAt` supports every orientation. Note that isometric maps extend to the left of the origin, so valid points there have negative x; `TiledMap`'s bounds start there too.

`tileAt` only returns cells inside the map's `width` x `height` grid. Infinite maps can have chunks outside that range, including negative coordinates; use `pixelToTile`, which is unbounded, for those.

## API Reference

### Exports

| Export                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `tiledMapLoader`      | PixiJS `LoadParser` extension - register with `extensions.add()` |
| `loadTiledMapAsset(url, options?)` | Load, resolve, texture, and render a TMJ/TMX map with optional renderer settings |
| `loadMapBlendModes(map)` | Load PixiJS' advanced blend modes if the map's layers use any; resolves at once otherwise |
| `TiledMapAsset`       | Loaded `mapData` plus a `TiledMap` container, rebuilt after `destroy` |
| `TiledMap`            | `Container` subclass that renders a resolved map                 |
| `TileLayerRenderer`   | Packed mesh-backed `Container` for a single tile layer           |
| `ImageLayerRenderer`  | `Container` for a single image layer                             |
| `ObjectLayerRenderer` | `Container` for a single object layer                            |
| `GroupLayerRenderer`  | `Container` for a group layer (recursive)                        |
| `PackedTileLayerRenderer` | Packed mesh base used by `TileLayerRenderer`, with a low-level `addTextureRect()` seam |
| `TileSetRenderer`     | Texture manager for a tileset                                    |
| `createLayerRenderer(layer, tilesets, ctx, imageTextures, imageGifSources?, layerFilter?, objectStyle?)` | Build the renderer for one resolved layer, as `TiledMap` does when `ctx` carries `mapHeight` and the map's pixel size |
| `createMap(options)`  | Create a resolved map procedurally                               |
| `createTileset(options)` | Create a resolved tileset                                     |
| `createTileLayer(options, tilesets?)` | Create a resolved tile layer                    |
| `createImageLayer(options)` | Create a resolved image layer                              |
| `createObjectLayer(options, tilesets?)` | Create a resolved object layer               |
| `createGroupLayer(options, tilesets?)` | Create a resolved group layer                  |
| `parseMap(data, options?)` | Synchronous Tiled JSON → resolved IR; `options` supplies external tilesets and templates |
| `parseMapAsync(data, options?)` | Async variant (required for gzip/zlib compressed data)   |
| `parseTmx(xml)`       | Parse TMX XML string → `TiledMap` data (same shape as JSON)      |
| `parseTsx(xml)`       | Parse TSX XML string → `TiledTileset` data (`firstgid` is `0`; the map's reference supplies the real value) |
| `parseTx(xml)`        | Parse TX XML string → `TiledObjectTemplate` data                 |
| `decodeLayerData(data, encoding?, compression?)` | Decode CSV or uncompressed base64 tile data into raw GIDs |
| `decodeLayerDataAsync(data, encoding?, compression?)` | Async variant that also decodes gzip/zlib |
| `decodeGid(raw)`      | Decode a raw GID into tile ID + flip flags                       |
| `encodeGid(tile)`     | Pack a resolved tile back into a raw GID - the inverse of `decodeGid` |
| `exportMap(map, options?)` | Resolved IR → Tiled JSON - the inverse of `parseMap`; keeps each layer's encoding but never compresses |
| `exportMapAsync(map, options?)` | Like `exportMap`, and also writes gzip/zlib compressed tile data - the inverse of `parseMapAsync` |
| `exportTileset(tileset, options?)` | Resolved tileset → embedded tileset data, or a standalone `.tsj` with `{ standalone: true }` |
| `findLayer(map, name)` | Find a resolved layer by name, including inside group layers    |
| `findLayerById(map, id)` | Find a resolved layer by its Tiled id                         |
| `walkLayers(map)`     | Iterate the layer tree depth-first, group layers included        |
| `getProperty(holder, name, type?)` | Read a Tiled custom property off a map, layer, object, or tileset; pass the Tiled type to narrow the result |
| `tileAt(map, x, y)`   | Map-space point → tile cell, or `null` outside the map           |
| `tileToPixel(col, row, ctx)` | Tile cell → map-space position of its image box, for every orientation |
| `pixelToTile(x, y, ctx)` | Unbounded map-space point → tile cell - the inverse of `tileToPixel` |

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
// Only needed for advanced blend modes (overlay, darken, ...); the asset
// loader does this itself. Without it the first frames blend normally.
await loadMapBlendModes(resolvedMap);

const map = new TiledMap(resolvedMap, {
  tilesetTextures, // Map<imagePath, Texture>
  imageLayerTextures, // Map<imagePath, Texture>
  tileImageTextures, // Map<imagePath, Texture> (image-collection tiles)
  tileImageGifSources, // Map<imagePath, GifSource> (animated image-collection tiles)
  imageLayerGifSources, // Map<imagePath, GifSource> (animated image layers)
  layerFilter, // optional (layer) => boolean, for rendering selected layers
  tileSpritePadding, // optional, defaults to 0.01 to hide fractional-scale seams
  tileMeshBatchSize, // optional, defaults to 16000 quads per packed mesh
  objectStyle, // optional, how object layers draw shapes, labels and text (below)
});

map.orientation; // 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal' | 'oblique'
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

Object layers draw shapes the way the Tiled editor does. `objectStyle` tunes that:

```ts
const map = new TiledMap(resolvedMap, {
  objectStyle: {
    fillAlpha: 0, // outlines only; defaults to the editor's 50/255
    showLabels: true, // name tags above named shapes (default false)
    defaultColor: '#ff8800', // for layers without their own color
    screenSpace: true, // one-device-pixel outlines at any zoom (default); redraws shapes on zoom
    clipText: false, // skip the per-object mask that clips text to its box
  },
});
```

Text objects with `kerning` turned off in Tiled render without kerning: the library switches the canvas `fontKerning` off while PixiJS measures and draws those texts.

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

Template-instance merging follows Tiled semantics. Tiled writes a field on an
instance only when the instance changed it, so every field the instance
carries wins - even a zero rotation - and every other field (name, size,
rotation, opacity, visibility, text, gid, and shape) comes from the template.
As in Tiled, an empty name and a size with a zero width or height count as
unchanged and take the template's. An instance shape replaces the template shape as a whole, and
custom properties merge by name, the instance winning. If the template carries
an external-tileset reference to a tileset the map also uses, `gid` is
translated from the template firstgid-space to the map firstgid-space,
preserving flip flags. The tileset paths are compared normalized, and a source
still relative to the template file is resolved against the template's key.

## Migration from v1

| v1 (PixiJS v4)                        | v2 (PixiJS v8)                                           |
| ------------------------------------- | -------------------------------------------------------- |
| `PIXI.loader.add('map.tmx').load(…)`  | `extensions.add(tiledMapLoader); Assets.load('map.tmj')` |
| `new PIXI.extras.TiledMap('map.tmx')` | `const { container } = await Assets.load('map.tmj')`     |
| Global namespace mutation             | Named ESM imports                                        |
| TMX XML via `tmx-parser`              | Built-in JSON + XML parser (no external deps)            |
| Tile + image layers only              | All layer types                                          |

## Development

Working on the library needs Node `^22.22.2`, `^24.15.0`, or `>=26`, the range the build and test tooling supports. `.node-version` selects Node 22 for version managers, and `devEngines` makes npm warn on an unsupported version. Using the published package has no Node requirement beyond the [requirements](#requirements) above.

```sh
npm install
npm run build        # ESM + CJS + types via tsdown
npm run dev          # watch mode
npm run check        # Biome lint + format
npm run typecheck    # tsc --noEmit
npm test             # Build, Vitest, and MagicLand visual regression
npm run bench        # renderer hot-path benchmarks
npm run quality:gate # check + typecheck + test, then the Fallow regression gate
```

`npm test` includes a headless MagicLand visual regression that renders a real TMX + GIF tileset fixture and pixel-compares it against a checked-in reference image.

- [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) - benchmark usage, the current smoke baseline, and how packed tile editing works
- [`docs/QUALITY.md`](docs/QUALITY.md) - the quality gate, CI and npm releases, and the Fallow baselines

[npm-url]: https://www.npmjs.com/package/pixi-tiledmap
[npm-image]: https://img.shields.io/npm/v/pixi-tiledmap.svg?style=flat
