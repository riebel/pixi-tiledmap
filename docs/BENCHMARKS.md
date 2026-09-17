# Benchmarks

Use the benchmark suite to smoke-test renderer hot paths after changing map geometry, tile layer rendering, tile visual creation, tileset texture lookup, or runtime tile editing.

```sh
npm run bench
```

The benchmarks are intentionally not part of `npm test`: local CPU, background load, and jsdom/PixiJS startup noise make strict pass/fail thresholds brittle. Treat them as a comparison tool before and after a performance-sensitive change.

- `test/renderer/TileLayerRenderer.bench.ts` covers initial layer construction.
- `test/renderer/tileEditing.bench.ts` covers runtime editing across map sizes, occupancy, and operation mixes.

`npm run bench` runs `vitest bench --run --reporter=verbose`; the result tables are only printed by the verbose reporter. Benchmarks use the Vitest 5 API through `benchGroup` from `test/helpers/bench.ts`: each group registers its benchmarks and runs them as one comparison inside a single test, with a generous timeout because a group can take over a minute.

## Comparing Results

Absolute numbers depend heavily on the machine and its current load. Compare a change against a baseline measured on the same machine in the same session: run the benchmarks, stash the change, run them again. A single run is not enough to separate a real regression from noise; repeat runs that look suspicious.

Investigate changes that consistently move a benchmark by more than about 15-20% without an intentional renderer tradeoff.

Vitest runs the benchmarks through Vite's module runner, which turns every imported binding into a getter. Some groups therefore report that they ["accessed module export getters too many times"](https://vitest.dev/guide/benchmarking#module-runner-overhead): part of the measured time is that getter overhead, for example on `tileToPixel`, not renderer work. It is the same for both sides of a same-session comparison, but it narrows the gap between a real change and noise, and it makes numbers from a different Vitest version or module layout hard to compare. Treat small differences, such as the few percent between PixiJS releases, with that in mind.

## Current Smoke Baseline

Recorded on September 16, 2026 for `2.9.0` with PixiJS `8.20.1` and Vitest `5.0.1`, jsdom, on the local development machine. Higher is better.

### Layer construction

| Benchmark | Result |
| --- | ---: |
| finite `64x64` tile layer | `663 hz` |
| finite `64x64` tile layer, `tileMeshBatchSize: 2000` | `630 hz` |
| infinite `16` chunks of `16x16` tiles | `658 hz` |
| animated finite `64x64` tile layer | `16 hz` |
| finite `256x256` tile layer from two alternating tilesets | `27 hz` |

The two-tileset case was added after `2.9.0` and measured on September 17, 2026 on the same machine; `2.9.0` itself builds it at `28 hz`. It guards the draw-order bookkeeping, which must stay free for layers whose tiles all keep to their cells.

### Runtime editing

| Benchmark | Result |
| --- | ---: |
| `1` insert into a `256x256` empty layer | `2,597 hz` |
| `100` inserts into a `256x256` empty layer | `2,162 hz` |
| `10000` inserts into a `256x256` empty layer | `120 hz` |
| `10000` clear/set cycles in a `64x64` dense layer | `91 hz` |
| `1000` inserts into a `16`-chunk infinite layer | `1,654 hz` |
| `10000` compatible updates in a `256x256` dense layer | `21 hz` |
| `1000` alpha updates in a `64x64` dense layer (rebuild) | `1.3 hz` |

Each editing benchmark includes building its layer, so results drop with layer size even for a single insert (`108,670 hz` at `32x32`, `637 hz` at `512x512`). Compare editing cases of the same layer size.

## Packed Tile Layers

- Static map tiles are packed into batchable PixiJS `Mesh` children, grouped by texture source and alpha.
- Grouping never changes what is drawn on top. A tile joins the newest mesh for its texture and alpha only if nothing it overlaps is drawn above that mesh; otherwise it starts a new mesh on top. A grid of map-sized cells records the highest draw position covering each cell. Tiles confined to their own cell shape only need to stay above tiles that are not, which a second, much smaller grid records, so an ordinary layer still gets one mesh per texture and alpha. The full grid is only kept while such an unconfined tile is being placed: it is filled from the tiles packed so far when the first one arrives and dropped when the layer is finalized, so a layer of confined tiles records nothing there, however many meshes it needs. A mesh opened only to keep draw order starts at `16` quads. Animated and GIF tile sprites take their place in the same draw order.
- Packed meshes default to `16000` quads each (`tileMeshBatchSize`), which stays below 16-bit index limits while keeping render object count low. Lower it only for a renderer or device profile that measurably prefers smaller meshes.
- Quad indices are cached by quad count and shared across mesh instances.
- Interleaved custom geometry is not used, because PixiJS v8 only batches `MeshGeometry` instances through its built-in mesh batcher.
- Animated tiles, GIF tiles, and tiles a hexagonal map turns by 60 or 120 degrees are object-backed visuals rather than packed quads; no quad corner order can express those turns. Object-backed tiles are why the animated construction benchmark is much slower. There is no shader-based atlas animation.
- A tile's quad covers the box Tiled's cell renderer draws into: its own size, or for `tilerendersize: 'grid'` the grid cell with the fitted image centered and the tile offset scaled with it; a diagonally flipped non-square tile gets the transposed box. The packed renderer computes the common case, a tile at its own size that is not diagonally flipped, inline and calls the shared box function only for the rest.

## Runtime Editing

`TileLayerRenderer` keeps a render handle for every packed cell and the batch state alive after the layer is built.

- **Updating an existing tile** that keeps its texture source and alpha group rewrites that quad in place. Unchanged positions or UVs skip the buffer upload.
- **Clearing a tile** zeroes its quad, which degenerates it so it renders nothing, and returns the slot to its batch.
- **Painting into an empty cell** takes the first available of:
  1. a slot freed by an earlier clear (per-batch LIFO free list);
  2. spare capacity in an existing batch;
  3. new capacity, grown geometrically and capped at `+1024` quads per step;
  4. an additional batch, bounded by `tileMeshBatchSize`.

A freshly built layer has right-sized batch geometry; before the first edit, editing support only costs one render handle per packed tile.

Inside a mesh, slot order decides draw order. An incremental insert can only append or recycle a slot, so it is used only while every tile quad stays inside its own grid cell, where quads cannot overlap. `tileSpritePadding` widens grid-sized quads to close seams; that overlap is tolerated up to `0.125`px (default `0.01`), where no rasterisation sample falls inside it. Larger padding is visible overlap and makes inserts rebuild.

`TiledMap` resolves tile layers through a cached index, so an edit does not walk the render children of other layers. Repeated `getTile`, `setTile`, and `clearTile` calls for the same layer reuse the last index hit while the index is current; any child added to or removed from the map or one of its group layers drops both. Lookups that fall back to walking the layer tree, such as duplicate layer names, are never cached, because reordering children emits no event.

### Edits that rebuild the layer

| Case | Reason |
| --- | --- |
| insert into an isometric, staggered, or hexagonal map | quads overlap, so slot order is visible |
| insert where a tile or tile sprite overhangs its cell (`tileoffset`, oversized tile) | same |
| insert with `tileSpritePadding` above `0.125`px | the padding becomes visible overlap |
| existing tile changes texture source or alpha group | a quad cannot move between batches in place |
| existing tile changes its quad size or position while any quad overhangs its cell | the quad would keep a draw position that no longer matches its overlaps |
| packed tile <-> animated, GIF, or turned hexagonal tile | the sprite child must be created or removed |
| tileset texture unavailable | nothing can be packed |

A rebuild reconstructs the tile layer's own meshes and sprites, including its sprite-backed tiles; children added by the caller stay in place. Repeatedly inserting animated tiles is therefore the most expensive editing pattern.

Structural counters, not timings, are asserted in `test/renderer/tileEditingIncremental.test.ts` and `test/renderer/tileEditingStress.test.ts`, so CI stays deterministic. A 30k-operation random edit sequence performs zero rebuilds, keeps capacity bounded by the layer's cell count, and leaves the rendered quads matching the layer data.

## Test Environment

Vitest setup stubs jsdom canvas contexts so PixiJS canvas probes stay quiet during renderer tests and benchmarks. The construction benchmarks use orthogonal geometry and a single tileset texture; each finite, infinite, and animated case renders `4096` map tiles.
