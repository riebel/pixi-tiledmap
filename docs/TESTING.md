# Testing

`npm test` builds `dist/` and runs every `test/**/*.test.ts`. A single source-level file runs without a build: `npx vitest run test/parser/exportMap.test.ts`. Benchmarks are separate; see [BENCHMARKS.md](BENCHMARKS.md).

## Layout

- `test/parser/`, `test/renderer/`, `test/*.test.ts` import sources directly and mirror `src/`.
- `test/package/` tests the built package, so it needs a fresh build:
  - `treeShaking.test.ts` bundles single imports from `dist/` with rolldown and fails if data-side APIs pull in PixiJS. It also expects the dynamic `pixi.js/advanced-blend-modes` import in the loader bundle.
  - `commonjs.test.ts` checks the CJS build registers advanced blend modes on the `require`d PixiJS instance.
  - `publishedTypes.test.ts` copies the `npm pack` file list into `node_modules/.cache/published-types`, with its own `package.json` so the package name does not resolve to this repository, and type-checks consumer code for `nodenext`, `node16`, and `bundler`. Its `@ts-expect-error` lines catch declarations degrading to `any`; keep them.
- `test/renderer/magiclandVisual.test.ts` renders `test/fixtures/magicland/MagicLand.tmx` from `dist/` in headless Chrome (`CHROME_PATH` overrides discovery) and pixel-compares it with `reference-render-1000x700.png`. Actual and diff images go to `test/fixtures/magicland/.visual-output/`. The page imports PixiJS through a shim generated from the `pixi.js` imports in `dist/`.
- `test/pixiPeerExports.test.ts` checks every value import from `pixi.js` in `src/` against `test/fixtures/pixiPeerExports-8.10.0.json`, the exports of the lowest peer version.

## Conventions

- `restoreMocks: true` is set, so spies need no cleanup.
- Assert concrete values (`toBeInstanceOf`, `toMatchObject`, exact values), not `toBeDefined()`, and never behind an `if` that can skip the assertion.
- Build `Resolved*` fixtures with `test/helpers/resolved.ts` unless the test documents the full shape.
- Test the loader through `loadTiledMapAsset` with fake `fetchFn` and `loadAsset` adapters instead of mocking PixiJS globals.
- Static map tiles are packed meshes, not sprites; assert editing behaviour through `src/renderer/packedTileStats.ts` rather than `TileLayerRenderer.children`.

## Export and parser correctness

- Cover `exportMap` with round-trip properties in `test/parser/exportMap.test.ts`: build a Tiled map and assert `parseMap(exportMap(parseMap(raw)))` equals `parseMap(raw)`. Shape assertions pass while the file is silently wrong.
- A round trip cannot see a field the first `parseMap` already dropped, and `toEqual` treats absent and `undefined` keys alike. Pin every new field with `toMatchObject` on both the parsed map and the export.
- TMX and TMJ must parse to identical data. Compare a TMX fixture against what Tiled writes to JSON (Tiled's `mapwriter.cpp`, `maptovariantconverter.cpp`), not against this parser's own output.
- `test/renderer/pixelToTile.test.ts` checks the geometry inverse against an independent nearest-centre oracle. Keep that oracle independent of the polygon logic it tests.
