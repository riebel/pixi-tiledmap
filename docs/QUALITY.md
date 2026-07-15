# Quality gate

Run the complete local gate before a release or pull request:

```sh
npm run quality:gate
```

It runs Biome, TypeScript, the complete build-backed Vitest suite, and the
Fallow regression gate. `npm test` performs the build once before Vitest, so
the visual tests always consume the current `dist/` output without a redundant
second build.

## Fallow

`npm run fallow:report` prints the current dead-code, dependency-cycle,
duplication, complexity, maintainability, and hotspot report. The package pins
Fallow 3.5.1 so local and CI results use the same analyzer and baseline format.

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

The current health baseline retains a small set of known complexity findings,
including performance-sensitive tile editing and existing large test helpers.
The current dead-code baseline is empty, and the previous renderer import cycle
has been removed.
