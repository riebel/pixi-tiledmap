# Benchmarks

Use the benchmark suite to smoke-test renderer hot paths after changing map geometry, tile layer rendering, tile visual creation, or tileset texture lookup.

```sh
npm run bench
```

The benchmark is intentionally not part of `npm test`: local CPU, background load, and jsdom/PixiJS startup noise make strict pass/fail thresholds brittle. Treat it as a comparison tool before and after a performance-sensitive change.

## Current Smoke Baseline

Recorded on May 7, 2026 on the local development machine:

| Benchmark | Approximate result |
| --- | ---: |
| finite `64x64` tile layer | `1209 hz` |
| infinite `16` chunks of `16x16` tiles | `1210 hz` |

Small variance is expected. Investigate changes that consistently move either benchmark by more than about 15-20% without an intentional renderer tradeoff.

## Notes

- The finite benchmark builds one packed `TileLayerRenderer` with `4096` map tiles.
- The infinite benchmark builds one packed `TileLayerRenderer` with `16` chunks and `4096` total map tiles.
- Both benchmarks use orthogonal map geometry and a single tileset texture.
- Packed meshes opt into PixiJS batch mode and are capped at `2000` tiles per mesh to avoid oversized standalone mesh draws.
- Vitest setup stubs jsdom canvas contexts so PixiJS canvas probes stay quiet during renderer tests and benchmarks.
