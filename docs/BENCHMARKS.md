# Benchmarks

Use the benchmark suite to smoke-test renderer hot paths after changing map geometry, tile layer rendering, tile visual creation, or tileset texture lookup.

```sh
npm run bench
```

The benchmark is intentionally not part of `npm test`: local CPU, background load, and jsdom/PixiJS startup noise make strict pass/fail thresholds brittle. Treat it as a comparison tool before and after a performance-sensitive change.

`test/renderer/TileLayerRenderer.bench.ts` covers initial layer construction.
`test/renderer/tileEditing.bench.ts` covers runtime editing across map sizes, occupancy, and operation mixes.

## Current Smoke Baseline

Recorded on May 25, 2026 on the local development machine:

| Benchmark | Approximate result |
| --- | ---: |
| finite `64x64` tile layer, legacy `2000`-tile batches | `796 hz` |
| finite `64x64` tile layer | `903 hz` |
| infinite `16` chunks of `16x16` tiles | `876 hz` |
| animated finite `64x64` tile layer | `14 hz` |

Small variance is expected. Investigate changes that consistently move any benchmark by more than about 15-20% without an intentional renderer tradeoff.

Note that this table has drifted from the machine it was recorded on. When re-measured on July 15, 2026, the unchanged `2.8.5` code produced roughly `755 hz` for the finite `64x64` layer, with individual runs spanning `699-793 hz` at `±4%` rme. Compare against a baseline you measured yourself in the same session rather than against the numbers above; a single run is not enough to separate a real regression from noise on this benchmark.

## Runtime Editing (2.8.6)

Before 2.8.6, `TileLayerRenderer.setTile()` had no render handle for an empty cell, so it fell back to `_rebuildLayer()` and reconstructed every quad of the layer. Painting therefore cost one full layer rebuild per operation. `clearTile()` degenerated the quad but dropped its handle, so the slot could never be reused and re-setting the same cell rebuilt as well.

2.8.6 keeps packed batch state alive after `finalize()` and packs a static tile into an empty cell directly:

1. reuse a slot released by an earlier clear (per-batch LIFO free list);
2. otherwise take a fresh slot from spare batch capacity;
3. otherwise grow capacity geometrically, capped at `+1024` quads per step;
4. otherwise open an additional batch, bounded by `tileMeshBatchSize`.

Freed and reserved slots are zeroed, which degenerates their quad so they render nothing. Batch geometry is right-sized at build time, so a freshly built static layer keeps exactly the memory footprint it had in 2.8.5.

Slot order, not render order, decides draw order inside a mesh. An incremental insert can only append or recycle a slot, so it is only used when every tile quad stays inside its own grid cell, where overlap - and therefore draw order - cannot matter. Everything else falls back to the 2.8.5 rebuild.

`tileSpritePadding` is the one intentional exception: it widens a grid-sized quad past its cell to close seams, so padded neighbours do overlap. That overlap is only tolerated while it stays well below one pixel (at most `0.125`px, against a `0.01` default), where no rasterisation sample falls inside the strip. `tileSpritePadding` is a public option with no upper bound, and a larger value is real, visible overlap - those layers rebuild instead.

### Measured before/after

Median of repeated runs, jsdom, July 15, 2026, same machine and session. Lower is better.

| Scenario | 2.8.5 | 2.8.6 | Change |
| --- | ---: | ---: | --- |
| `100` inserts into a `256x256` empty layer | `44.13 ms` | `0.76 ms` | ~`58x` faster |
| `2000` clear/set cycles on a `64x64` dense layer | `1911.65 ms` | `6.41 ms` | ~`298x` faster |
| `1000` inserts into a `16`-chunk infinite layer | `4.78 ms` | `1.18 ms` | ~`4x` faster |
| `10000` compatible updates of existing tiles | `44.32 ms` | `42.59 ms` | parity (within noise) |
| initial build, dense `256x256` | `31.52 ms` | `31.91 ms` | parity (within noise) |
| initial build, sparse `512x512` | `1.69 ms` | `1.60 ms` | parity (within noise) |
| `setTile` behind a sprite-heavy sibling layer | `18.5 us` | `2.6 us` | ~`7x` faster |

The last row is the tile-layer index: `TiledMap` lookups previously walked the whole render tree, so an edit paid for the render children of every earlier layer. Editing cost is now independent of what sibling layers contain (`2.6 us` vs `2.6 us` behind a packed layer).

Structural counters are asserted in `test/renderer/tileEditingIncremental.test.ts` and `test/renderer/tileEditingStress.test.ts` rather than timings, so CI stays deterministic. A 30k-operation random edit sequence performs zero rebuilds, keeps capacity bounded by the layer's cell count, and leaves the rendered quads matching the layer data.

### Cases that still rebuild

| Case | Why | Rebuilt data |
| --- | --- | --- |
| insert into isometric / staggered / hexagonal maps | quads overlap, so slot order is visually significant | whole layer |
| insert where a tile overhangs its cell (`tileoffset`, oversized tile) | same | whole layer |
| insert with `tileSpritePadding` above `0.125`px | the seam overhang becomes visible overlap, so draw order is significant | whole layer |
| existing tile changes texture source or alpha group | an in-place update cannot move a quad between batches | whole layer |
| packed tile <-> sprite-backed tile (animation, GIF) | the sprite child must be created or removed | whole layer |
| tileset texture unavailable | nothing can be packed | whole layer |

All of these rebuilt in 2.8.5 too, so none is a regression; they are unchanged, not improved. Inserting animated tiles repeatedly remains the most expensive pattern (measured ~`9 ms` per operation for a 1024-sprite layer), because each insert rebuilds every sprite in the layer.

## Notes

- The finite benchmark builds one packed `TileLayerRenderer` with `4096` map tiles.
- The infinite benchmark builds one packed `TileLayerRenderer` with `16` chunks and `4096` total map tiles.
- The animated benchmark builds `4096` object-backed animated map tile visuals and is intentionally much slower than packed static layers.
- Both benchmarks use orthogonal map geometry and a single tileset texture.
- Packed meshes opt into PixiJS batch mode and default to `16000` tiles per mesh, staying below 16-bit index limits while reducing render object count. Use `tileMeshBatchSize` to lower that cap for a specific renderer/device profile.
- Packed mesh indices are cached by quad count and reused across mesh instances.
- Packed static tiles are grouped by texture source and alpha. Runtime edits that keep the same texture source and alpha can update existing mesh buffers; changed alpha groups require rebuilding the affected layer.
- Interleaved custom geometry is intentionally not used because PixiJS v8 only batches `MeshGeometry` instances through the built-in mesh batcher.
- Shader-style atlas animation was evaluated and left out for now; Tiled animated tiles still use object-backed animated visuals, reflected by the animated benchmark.
- Vitest setup stubs jsdom canvas contexts so PixiJS canvas probes stay quiet during renderer tests and benchmarks.
