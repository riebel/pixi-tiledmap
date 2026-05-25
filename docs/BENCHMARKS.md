# Benchmarks

Use the benchmark suite to smoke-test renderer hot paths after changing map geometry, tile layer rendering, tile visual creation, or tileset texture lookup.

```sh
npm run bench
```

The benchmark is intentionally not part of `npm test`: local CPU, background load, and jsdom/PixiJS startup noise make strict pass/fail thresholds brittle. Treat it as a comparison tool before and after a performance-sensitive change.

## Current Smoke Baseline

Recorded on May 25, 2026 on the local development machine:

| Benchmark | Approximate result |
| --- | ---: |
| finite `64x64` tile layer, legacy `2000`-tile batches | `796 hz` |
| finite `64x64` tile layer | `903 hz` |
| infinite `16` chunks of `16x16` tiles | `876 hz` |
| animated finite `64x64` tile layer | `14 hz` |

Small variance is expected. Investigate changes that consistently move any benchmark by more than about 15-20% without an intentional renderer tradeoff.

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
