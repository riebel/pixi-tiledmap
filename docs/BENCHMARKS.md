# Benchmarks

Use the benchmark suite to smoke-test renderer hot paths after changing map geometry, tile layer rendering, tile visual creation, tileset texture lookup, or runtime tile editing.

```sh
npm run bench
```

The benchmarks are intentionally not part of `npm test`: local CPU, background load, and jsdom/PixiJS startup noise make strict pass/fail thresholds brittle. Treat them as a comparison tool before and after a performance-sensitive change.

- `test/renderer/TileLayerRenderer.bench.ts` covers initial layer construction and one ticker update of an animated layer.
- `test/renderer/tileEditing.bench.ts` covers runtime editing across map sizes, occupancy, and operation mixes.

`npm run bench` runs `vitest bench --run --reporter=verbose`; the result tables are only printed by the verbose reporter. Benchmarks use the Vitest 5 API through `benchGroup` from `test/helpers/bench.ts`: each group registers its benchmarks and runs them as one comparison inside a single test, with a generous timeout because a group can take over a minute.

## Comparing Results

Absolute numbers depend heavily on the machine and its current load. Compare a change against a baseline measured on the same machine in the same session: run the benchmarks, stash the change, run them again. A single run is not enough to separate a real regression from noise; repeat runs that look suspicious.

Investigate changes that consistently move a benchmark by more than about 15-20% without an intentional renderer tradeoff.

Vitest runs the benchmarks through Vite's module runner, which turns every imported binding into a getter. Some groups therefore report that they ["accessed module export getters too many times"](https://vitest.dev/guide/benchmarking#module-runner-overhead): part of the measured time is that getter overhead, for example on `tileToPixel`, not renderer work. It is the same for both sides of a same-session comparison, but it narrows the gap between a real change and noise, and it makes numbers from a different Vitest version or module layout hard to compare. Treat small differences, such as the few percent between PixiJS releases, with that in mind.

## Current Smoke Baseline

Recorded on September 17, 2026 after `2.10.0` with PixiJS `8.20.1` and Vitest `5.0.1`, jsdom, on the local development machine. Higher is better. Against `2.10.0`, construction and dense editing gained 30-70% from dropping per-tile allocations (string cell keys, UV corner arrays), alpha or texture group changes no longer rebuild the layer, building an animated layer is about 8x faster now that a layer drives its animated tile visuals from one ticker listener, and a tile lookup in an infinite layer no longer scans its chunks; empty-layer inserts are unchanged within noise. Run-to-run spread on this machine reaches 20% for the dense editing cases, so compare a change against a fresh baseline rather than against this table.

### Layer construction

| Benchmark | Result |
| --- | ---: |
| finite `64x64` tile layer | `926 hz` |
| finite `64x64` tile layer, `tileMeshBatchSize: 2000` | `803 hz` |
| infinite `16` chunks of `16x16` tiles | `889 hz` |
| animated finite `64x64` tile layer | `134 hz` |
| finite `256x256` tile layer from two alternating tilesets | `33 hz` |

The two-tileset case guards the draw-order bookkeeping, which must stay free for layers whose tiles all keep to their cells.

### Animated tile ticks

| Benchmark | Result |
| --- | ---: |
| one shared ticker update of an animated `64x64` layer | `10,449 hz` |

### Runtime editing

| Benchmark | Result |
| --- | ---: |
| `1` insert into a `256x256` empty layer | `2,420 hz` |
| `100` inserts into a `256x256` empty layer | `2,101 hz` |
| `10000` inserts into a `256x256` empty layer | `157 hz` |
| `10000` clear/set cycles in a `64x64` dense layer | `142 hz` |
| `1000` inserts into a `16`-chunk infinite layer | `1,881 hz` |
| `1000` `getTile` in a `16`-chunk infinite layer | `48,351 hz` |
| `1000` `getTile` in a `1024`-chunk infinite layer | `26,374 hz` |
| `10000` compatible updates in a `256x256` dense layer | `34 hz` |
| `1000` alpha group changes in a `64x64` dense layer | `696 hz` |

Each editing benchmark includes building its layer, so results drop with layer size even for a single insert (`94,096 hz` at `32x32`, `593 hz` at `512x512`), and dense `256x256` cases are dominated by the build. Compare editing cases of the same layer size.

## Animated Tiles in a Real Browser

The Vitest benchmarks run in jsdom without a renderer, so they cannot price
what animated tiles cost once they are on screen. `scripts/measureAnimatedTiles.mjs`
serves a page to headless Chrome that builds the same tiles as one
`AnimatedSprite` each, as one batched `Mesh` of quads whose UVs are rewritten
on a frame change, and without animation at all, then times
`render()` plus a `gl.finish()` sync point:

```sh
MEASURE_GPU=1 npm run measure:animated
```

It is configured through the environment, like the MagicLand visual test:
`MEASURE_TILES` (default `4096`), `MEASURE_FRAMES` (`300`), `MEASURE_ANIMATED`
(all tiles), and `MEASURE_GPU=1`. It measures PixiJS primitives, not this
package, so it answers a design question rather than guarding this renderer.
Without `MEASURE_GPU` Chrome rasterises in software, where a buffer upload
costs orders of magnitude more than on a GPU; the reported GL renderer string
is part of the result.

Measured on an RTX 3080, ms per frame, every tile animated unless noted:

| Animated tiles | one sprite each | packed quads |
| --- | ---: | ---: |
| `512` of `4096` | `0.090` | `0.051` |
| `4096` | `0.245` | `0.071` |
| `16384` | `1.513` | `0.181` |

Static tiles of either shape cost about `0.01`ms, so the whole difference is
the animation. Packed quads move the work into the frames where the animation
frame actually changes: at `16384` tiles a change frame costs `0.96`ms while a
steady frame costs `0.03`ms, against `2.1`ms and `1.4`ms for sprites.

This is why animated tiles are still sprites. Below about a thousand animated
tiles the difference is a rounding error in a 16ms frame; it only reaches 8% of
a frame budget at `16384` simultaneously animated tiles. Packing them would
cost the `AnimatedSprite` children and their per-tile playback control, a batch
per animation so a frame change does not re-upload a whole layer, and a sprite
fallback for animations whose frames live in different texture sources. If a
map with thousands of animated tiles makes that trade worth it, it belongs
behind an option rather than in the default path.

## Packed Tile Layers

- Static map tiles are packed into batchable PixiJS `Mesh` children, grouped by texture source and alpha.
- Grouping never changes what is drawn on top. A tile joins the newest mesh for its texture and alpha only if nothing it overlaps is drawn above that mesh; otherwise it starts a new mesh on top. A grid of map-sized cells records the highest draw position covering each cell. Tiles confined to their own cell shape only need to stay above tiles that are not, which a second, much smaller grid records, so an ordinary layer still gets one mesh per texture and alpha. The full grid is only kept while such an unconfined tile is being placed: it is filled from the tiles packed so far when the first one arrives and dropped when the layer is finalized, so a layer of confined tiles records nothing there, however many meshes it needs. A mesh opened only to keep draw order starts at `16` quads. Animated and GIF tile sprites take their place in the same draw order.
- Packed meshes default to `16000` quads each (`tileMeshBatchSize`), which stays below 16-bit index limits while keeping render object count low. Lower it only for a renderer or device profile that measurably prefers smaller meshes.
- Quad indices are cached by quad count and shared across mesh instances.
- Interleaved custom geometry is not used, because PixiJS v8 only batches `MeshGeometry` instances through its built-in mesh batcher.
- Animated tiles, GIF tiles, and tiles a hexagonal map turns by 60 or 120 degrees are object-backed visuals rather than packed quads; no quad corner order can express those turns. Object-backed tiles are why the animated construction benchmark is much slower. There is no shader-based atlas animation.
- A tile layer advances all of its animated tile visuals from one `Ticker.shared` listener (`tileAnimationTicker.ts`), because PixiJS' `autoUpdate` connects each sprite on its own: connecting `4096` of them cost more than creating them, about 55ms of the 64ms an animated `64x64` layer took to build. The frame list an animated tile hands to `AnimatedSprite` is built once per tileset tile, not once per instance. Advancing the sprites is still one `update()` call each, so a tick costs about the same as before; only the listener count and the build changed. A sprite the caller reconnects by setting `autoUpdate` back to `true` is skipped by the layer, so it is never advanced twice per frame.
- A tile's quad covers the box Tiled's cell renderer draws into: its own size, or for `tilerendersize: 'grid'` the grid cell with the fitted image centered and the tile offset scaled with it; a diagonally flipped non-square tile gets the transposed box. The packed renderer computes the common case, a tile at its own size that is not diagonally flipped, inline and calls the shared box function only for the rest.

## Runtime Editing

`TileLayerRenderer` keeps a render handle for every packed cell and the batch state alive after the layer is built.

- **Updating an existing tile** that keeps its texture source and alpha group rewrites that quad in place. Unchanged positions or UVs skip the buffer upload.
- **Changing an existing tile's texture source or alpha group** clears its quad and inserts it into a batch of the new group, under the same conditions as painting into an empty cell. The old batch keeps the freed slot, so its mesh stays even when every slot is free.
- **Clearing a tile** zeroes its quad, which degenerates it so it renders nothing, and returns the slot to its batch.
- **Painting into an empty cell** takes the first available of:
  1. a slot freed by an earlier clear (per-batch LIFO free list);
  2. spare capacity in an existing batch;
  3. new capacity, grown geometrically and capped at `+1024` quads per step;
  4. an additional batch, bounded by `tileMeshBatchSize`.

A freshly built layer has right-sized batch geometry; before the first edit, editing support only costs one render handle per packed tile.

Inside a mesh, slot order decides draw order. An incremental insert can only append or recycle a slot, so it is used only while every tile quad stays inside its own grid cell, where quads cannot overlap. `tileSpritePadding` widens grid-sized quads to close seams; that overlap is tolerated up to `0.125`px (default `0.01`), where no rasterisation sample falls inside it. Larger padding is visible overlap and makes inserts rebuild.

An infinite layer resolves a coordinate to its chunk through a grid of chunk columns and rows, built once per layer, so a lookup does not walk every chunk: at `1024` chunks that is about `32`ns instead of `780`ns. The grid only forms when all chunks share a size and sit on multiples of it, which is how Tiled writes infinite maps; ragged or overlapping chunks keep the scan, whose first match the grid reproduces. Below `32` chunks the scan is faster, so no grid is built.

`TiledMap` resolves tile layers through a cached index, so an edit does not walk the render children of other layers. Repeated `getTile`, `setTile`, and `clearTile` calls for the same layer reuse the last index hit while the index is current; any child added to or removed from the map or one of its group layers drops both. Lookups that fall back to walking the layer tree, such as duplicate layer names, are never cached, because reordering children emits no event.

### Edits that rebuild the layer

| Case | Reason |
| --- | --- |
| insert into an isometric, staggered, or hexagonal map | quads overlap, so slot order is visible |
| insert where a tile or tile sprite overhangs its cell (`tileoffset`, oversized tile) | same |
| insert with `tileSpritePadding` above `0.125`px | the padding becomes visible overlap |
| existing tile changes texture source or alpha group, in a layer where inserts rebuild | the moved quad is an insert |
| existing tile changes its quad size or position while any quad overhangs its cell | the quad would keep a draw position that no longer matches its overlaps |
| packed tile <-> animated, GIF, or turned hexagonal tile | the sprite child must be created or removed |
| tileset texture unavailable | nothing can be packed |

A rebuild reconstructs the tile layer's own meshes and sprites, including its sprite-backed tiles; children added by the caller stay in place. Repeatedly inserting animated tiles is therefore the most expensive editing pattern.

Structural counters, not timings, are asserted in `test/renderer/tileEditingIncremental.test.ts` and `test/renderer/tileEditingStress.test.ts`, so CI stays deterministic. A 30k-operation random edit sequence performs zero rebuilds, keeps capacity bounded by the layer's cell count, and leaves the rendered quads matching the layer data.

## Test Environment

Vitest setup stubs jsdom canvas contexts so PixiJS canvas probes stay quiet during renderer tests and benchmarks. The construction benchmarks use orthogonal geometry and a single tileset texture; each finite, infinite, and animated case renders `4096` map tiles.
