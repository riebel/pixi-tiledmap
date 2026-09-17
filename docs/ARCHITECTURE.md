# Architecture

The library has a data side (types, parser, export, procedural maps, lookups) and a render side (PixiJS). `src/index.ts` re-exports both. Detailed semantics live in each module's doc comments; this page is the map.

```text
TMJ / TMX ──parseTmx──▶ Tiled* data ──parseMap(Async)──▶ ResolvedMap ──▶ TiledMap (PixiJS)
                                           ▲    │
                          createMap ───────┘    └──exportMap(Async)──▶ TMJ
```

## Types (`src/types/index.ts`)

- **`Tiled*`** mirror the Tiled JSON map format (1.11, plus the 1.12 additions): the unresolved shapes of a `.tmj` file or a parsed `.tmx` file.
- **`Resolved*`** are the IR: defaults filled, external tilesets inlined, templates merged, GIDs decoded into `ResolvedTile`s, layer data decoded. Parsers only emit them; renderers only consume them.
- `TiledTilesetFile` (`Omit<TiledTileset, 'firstgid'>`) is a standalone `.tsj`/`.tsx`. The map's reference supplies `firstgid`, so `ParseOptions.externalTilesets` and the loader accept the file type.
- GID flag constants (`FLIPPED_HORIZONTALLY_FLAG`, ...) are exported here.

## Data side

| Module | Role |
| --- | --- |
| `parser/resolveMap.ts` | `parseMap` (sync) / `parseMapAsync` (needed for gzip/zlib, via the Compression Streams API). Tile-layer assembly is shared; sync and async differ only in data decoding. |
| `parser/decodeData.ts` | CSV, base64, gzip/zlib base64. zstd throws: the Compression Streams API does not offer it. |
| `parser/decodeGid.ts`, `encodeGid.ts` | Raw GID to `ResolvedTile` and back, exact inverses. |
| `parser/exportMap.ts` | `exportMap` / `exportMapAsync` / `exportTileset`, the inverse of `parseMap`. Tile layers keep their base64 encoding; only the async export compresses. |
| `parser/mergeTemplate.ts` | Tiled object-template semantics and GID remapping into the map's tileset space. |
| `parser/parseTmx.ts` | `parseTmx`, `parseTsx`, `parseTx`; delegates to `tmxData`, `tmxObjects`, `tmxProperties`, `tmxTilesets`, `xmlHelpers`. |
| `parser/relativePath.ts` | Pixi-free path normalization, shared with the asset loader. |
| `parser/tilesetHelpers.ts` | Tileset references, GID to tileset lookup, column counts. |
| `procedural.ts` | `createMap`, `createTileset`, `create*Layer`: build `Resolved*` data directly. |
| `resolvedDefaults.ts` | Tiled default values shared by parser and procedural API. |
| `resolvedTile.ts` | GIDs and `{ tileset, tileId }` refs to `ResolvedTile`, for parser and procedural API. |
| `idCounters.ts` | Keeps `nextlayerid`/`nextobjectid` above every id in use, identically in parser, `createMap`, and export, so the round trip stays exact. |
| `mapLookup.ts` | `findLayer`, `findLayerById`, `walkLayers`, `getProperty` on a `ResolvedMap`. Deliberately separate from `renderer/layerTreeLookup.ts`, so a tool can inspect a map without a `TiledMap`. |

External tilesets and object templates are not fetched by the parser; callers pass them through `ParseOptions.externalTilesets` and `ParseOptions.templates`.

The library is a map generator as well as a viewer, so parse and export form a round-trip pair: `parseMap(exportMap(parseMap(raw)))` deep-equals `parseMap(raw)`. The one exception is a gzip/zlib layer, which the sync `exportMap` writes as uncompressed base64 without `compression`; it round-trips exactly only through `exportMapAsync` and `parseMapAsync`.

## Render side (`src/renderer/`)

| Module | Role |
| --- | --- |
| `TiledMap.ts` | Root `Container`: owns the tileset renderers, builds the layer tree, `applyParallax`, and routes `getTile`/`setTile`/`clearTile` through a cached tile-layer index. |
| `layerTreeRenderer.ts`, `layerRendererFactory.ts` | Layer traversal, `layerFilter`, and renderer construction from one context. Group layers receive the factory, which keeps the module graph acyclic. |
| `renderableLayer.ts` | Shared layer state: label, alpha, visibility, tint, blend mode, offset, parallax. Parallax targets this seam, not concrete renderers. |
| `TileLayerRenderer.ts` | One tile layer, including infinite-map chunks and their lookup grid, render order, and runtime edits. |
| `PackedTileLayerRenderer.ts` | Batchable `Mesh` packing grouped by texture source and alpha, keeping painter order; `addTextureRect()` is the low-level packing seam. See [BENCHMARKS.md](BENCHMARKS.md). |
| `tileDrawPlan.ts` | Per-tile draw box (Tiled's `CellRenderer`), UVs, and the packed-quad-or-object-visual decision. |
| `tileSpriteFactory.ts` | Object-backed tile visuals: animated/GIF map tiles, tile objects, flips, hexagonal turns. |
| `tileAnimationTicker.ts` | One `Ticker.shared` listener per tile layer for its animated tile visuals, instead of PixiJS' one per sprite. |
| `TileSetRenderer.ts` | Slices tileset textures, resolves `tilerendersize`/`fillmode`, holds GIF sources. |
| `ImageLayerRenderer.ts` | Image layers: repeat, GIF, `transparentcolor`, placed at Tiled's screen origin. |
| `ObjectLayerRenderer.ts` | Object layers styled like the Tiled editor (`TiledObjectStyle`), `topdown` order, isometric/oblique projection. |
| `GroupLayerRenderer.ts` | Nested layers. |
| `layerTreeLookup.ts` | `getLayer` by label and the tile-layer index, over the rendered container tree. |
| `mapGeometry.ts` | Pixi-free: map bounds, tile placement, render-order plans for every orientation, and the inverse `pixelToTile`/`tileAt`. |
| `blendModes.ts` | Loads `pixi.js/advanced-blend-modes` on demand. |
| `colorKey.ts` | Shared, reference-counted `transparentcolor` texture copies. |
| `textKerning.ts` | Tiled `kerning: false` through two wrapped PixiJS text internals. |
| `parseColor.ts` | Tiled `#AARRGGBB`/`#RRGGBB` to PixiJS `Color`. |
| `packedTileStats.ts` | Internal rebuild/slot/upload counters for tests and benchmarks; not exported. |
| `tiledAssetLoader.ts` | `tiledMapLoader` extension and the `loadTiledMapAsset` pipeline. |

### Asset loader

`tiledMapLoader.load` stays a thin wrapper around `loadTiledMapAsset`, which, given a `.tmx`/`.tmj` URL:

1. fetches and parses the map;
2. fetches and parses external tilesets and templates in parallel;
3. calls `parseMapAsync`;
4. collects the texture manifest (tileset atlases, image-collection tiles, image layers);
5. loads it with `Assets.load`, GIFs through `pixi.js/gif`;
6. returns `{ mapData, container }`.

The `Assets` cache returns the same asset on every load, so `container` is a getter that rebuilds a destroyed map. `unload` destroys the container; textures and GIF sources stay in the cache.

Without the loader, call `parseMap`/`parseMapAsync` yourself and pass loaded textures through `TiledMapOptions`.

## Packaging

- `dist/` is unbundled (`unbundle: true`), one module per source file, with `"sideEffects": false`, so bundlers drop unused modules. A single bundle would keep the renderer in parser-only builds through side effects such as `extensions.add(GifAsset)`.
- The data-side modules and `mapGeometry.ts` must not import `pixi.js`, except the XML parsers' `DOMAdapter`. `test/package/treeShaking.test.ts` enforces this.
- The CJS build keeps `pixi.js/advanced-blend-modes` a `require` (`dynamicImportInCjs: false`), because `import()` from CommonJS would load a second, ESM instance of PixiJS.
- The `pixi.js` peer range starts at 8.10.0; `test/pixiPeerExports.test.ts` checks every imported name against that version.

## Compatibility constraints

- `parseTsx` returns `TiledTileset` with `firstgid: 0` for 2.8.x callers. Narrowing it to `TiledTilesetFile` is reserved for the next major.
- `createLayerRenderer.ts` and `tilePlacement.ts` are public compatibility wrappers; keep them thin.
- `TileLayerRenderer.children` is not a per-tile sprite API.

## Tiled references

- [JSON map format](https://doc.mapeditor.org/en/stable/reference/json-map-format/), [TMX map format](https://doc.mapeditor.org/en/stable/reference/tmx-map-format/)
- Where the docs are silent, Tiled's source is authoritative: `src/libtiled/mapwriter.cpp`, `maptovariantconverter.cpp`, and the renderers in `src/libtiled/`.
