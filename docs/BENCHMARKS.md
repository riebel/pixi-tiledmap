# Benchmarks

Use the benchmark suite to smoke-test renderer hot paths after changing map geometry, tile layer rendering, tile visual creation, tileset texture lookup, or runtime tile editing.

```sh
npm run bench
```

The benchmarks are intentionally not part of `npm test`: local CPU, background load, and jsdom/PixiJS startup noise make strict pass/fail thresholds brittle. Treat them as a comparison tool before and after a performance-sensitive change.

- `test/renderer/TileLayerRenderer.bench.ts` covers initial layer construction.
- `test/renderer/tileEditing.bench.ts` covers runtime editing across map sizes, occupancy, and operation mixes.

## Comparing Results

Absolute numbers depend heavily on the machine and its current load. Compare a change against a baseline measured on the same machine in the same session: run the benchmarks, stash the change, run them again. A single run is not enough to separate a real regression from noise; repeat runs that look suspicious.

Investigate changes that consistently move a benchmark by more than about 15-20% without an intentional renderer tradeoff.

## Current Smoke Baseline

Recorded on September 16, 2026 for `2.9.0`, jsdom, on the local development machine. Higher is better.

### Layer construction

| Benchmark | Result |
| --- | ---: |
| finite `64x64` tile layer | `727 hz` |
| finite `64x64` tile layer, `tileMeshBatchSize: 2000` | `645 hz` |
| infinite `16` chunks of `16x16` tiles | `697 hz` |
| animated finite `64x64` tile layer | `15 hz` |

### Runtime editing

| Benchmark | Result |
| --- | ---: |
| `1` insert into a `256x256` empty layer | `2,261 hz` |
| `100` inserts into a `256x256` empty layer | `2,014 hz` |
| `10000` inserts into a `256x256` empty layer | `121 hz` |
| `10000` clear/set cycles in a `64x64` dense layer | `101 hz` |
| `1000` inserts into a `16`-chunk infinite layer | `1,799 hz` |
| `10000` compatible updates in a `256x256` dense layer | `22 hz` |
| `1000` alpha updates in a `64x64` dense layer (rebuild) | `1.7 hz` |

Each editing benchmark includes building its layer, so results drop with layer size even for a single insert (`102,440 hz` at `32x32`, `575 hz` at `512x512`). Compare editing cases of the same layer size.

## Packed Tile Layers

- Static map tiles are packed into batchable PixiJS `Mesh` children, grouped by texture source and alpha.
- Packed meshes default to `16000` quads each (`tileMeshBatchSize`), which stays below 16-bit index limits while keeping render object count low. Lower it only for a renderer or device profile that measurably prefers smaller meshes.
- Quad indices are cached by quad count and shared across mesh instances.
- Interleaved custom geometry is not used, because PixiJS v8 only batches `MeshGeometry` instances through its built-in mesh batcher.
- Animated tiles and GIF tiles are object-backed visuals rather than packed quads, which is why the animated construction benchmark is much slower. There is no shader-based atlas animation.

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

`TiledMap` resolves tile layers through a cached index, so an edit does not walk the render children of other layers.

### Edits that rebuild the layer

| Case | Reason |
| --- | --- |
| insert into an isometric, staggered, or hexagonal map | quads overlap, so slot order is visible |
| insert where a tile overhangs its cell (`tileoffset`, oversized tile) | same |
| insert with `tileSpritePadding` above `0.125`px | the padding becomes visible overlap |
| existing tile changes texture source or alpha group | a quad cannot move between batches in place |
| packed tile <-> animated or GIF tile | the sprite child must be created or removed |
| tileset texture unavailable | nothing can be packed |

A rebuild reconstructs the tile layer's own meshes and sprites, including its sprite-backed tiles; children added by the caller stay in place. Repeatedly inserting animated tiles is therefore the most expensive editing pattern.

Structural counters, not timings, are asserted in `test/renderer/tileEditingIncremental.test.ts` and `test/renderer/tileEditingStress.test.ts`, so CI stays deterministic. A 30k-operation random edit sequence performs zero rebuilds, keeps capacity bounded by the layer's cell count, and leaves the rendered quads matching the layer data.

## Test Environment

Vitest setup stubs jsdom canvas contexts so PixiJS canvas probes stay quiet during renderer tests and benchmarks. The construction benchmarks use orthogonal geometry and a single tileset texture; each finite, infinite, and animated case renders `4096` map tiles.
