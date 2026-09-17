# Quality gate

Run the complete local gate before a release or pull request:

```sh
npm run quality:gate
```

CI (`.github/workflows/ci.yml`) runs the same gate on Node 22 and 24 for every
push to `master` and every pull request.

## Releases

Publishing a GitHub release starts `.github/workflows/publish.yml`. It checks
that the release tag matches `v` plus the `package.json` version, runs the gate,
and publishes to npm through Trusted Publishing: npm authenticates the workflow
over OIDC, so no npm token is stored, and adds provenance. The trusted publisher
on npmjs.com names this repository, `publish.yml`, and the `npm` environment;
renaming the workflow file or the environment breaks publishing until the npm
settings are updated too.

It runs Biome, TypeScript, the complete build-backed Vitest suite, and the
Fallow regression gate. `npm test` performs the build once before Vitest, so
the tests that use `dist/` always see the current output without a redundant
second build: the MagicLand visual regression and the package tests in
`test/package/`, described in [`TESTING.md`](TESTING.md). The declarations are
emitted by TypeScript's native compiler, whose tsdown integration is still
experimental, so `publishedTypes.test.ts` pins them against silent changes.

## Fallow

`npm run fallow:report` prints the current dead-code, dependency-cycle,
duplication, complexity, maintainability, and hotspot report. The package pins
Fallow 3.26.0 so local and CI results use the same analyzer and baseline format.

The tracked files in `quality/fallow/` are fingerprint baselines. They accept
only findings reviewed when the baseline was created; new dead code, a new
cycle, a new complexity finding, or a new duplicate group makes
`npm run fallow:gate` fail. The baseline is intentionally more precise than a
single issue-count budget, where removing one old issue could hide one new
issue.

Refresh the baselines only after reviewing the full report and deciding that
every remaining finding is intentional:

```sh
npm run fallow:report
npm run fallow:baseline
npm run fallow:gate
```

Never refresh a baseline merely to make a failing gate green. Fix a regression
when practical; otherwise document why accepting that specific finding is the
safer choice in the change that updates the baseline.

## Accepted findings

The dead-code and duplication baselines are empty. The health baseline accepts
these findings on purpose:

- `TileLayerRenderer.setTile`, `TileLayerRenderer._findCell`, and
  `PackedTileLayerRenderer.updatePackedTile` are renderer hot paths. They stay
  as plain branches and loops because splitting them costs allocations or calls
  per edited tile; see [`BENCHMARKS.md`](BENCHMARKS.md).
- `findChrome` in the MagicLand visual test and one helper in the tile editing
  stress test are test infrastructure.
- The refactoring targets `src/resolvedTile.ts` and `src/parser/xmlHelpers.ts`
  are flagged for their number of importers, not their size. Both are small,
  single-purpose modules, and splitting them would add dependencies rather
  than remove them.

Churn hotspots are also reported. They are derived from Git history and are
not a code finding to fix.
