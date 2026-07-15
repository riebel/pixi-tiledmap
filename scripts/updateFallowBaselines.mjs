import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const baselineDir = resolve('quality/fallow')
const refreshDir = resolve(baselineDir, `.refresh-${process.pid}`)
const fallowCli = resolve('node_modules/fallow/bin/fallow')
const analyses = [
  ['dead-code', 'dead-code.json'],
  ['health', 'health.json'],
  ['dupes', 'dupes.json']
]

mkdirSync(baselineDir, { recursive: true })
rmSync(refreshDir, { force: true, recursive: true })
mkdirSync(refreshDir)

try {
  for (const [analysis, filename] of analyses) {
    const baselinePath = resolve(refreshDir, filename)
    const result = spawnSync(
      process.execPath,
      [fallowCli, analysis, '--save-baseline', baselinePath, '--format', 'compact', '--quiet'],
      { stdio: 'inherit' }
    )

    if (result.error) throw result.error

    // Findings can produce exit 1 even though Fallow wrote the requested
    // baseline. A fresh file proves this run completed; exit 2 denotes a
    // tool/configuration error.
    if ((result.status !== 0 && result.status !== 1) || !existsSync(baselinePath)) {
      throw new Error(`Failed to refresh the ${analysis} Fallow baseline.`)
    }
  }

  for (const [, filename] of analyses) {
    copyFileSync(resolve(refreshDir, filename), resolve(baselineDir, filename))
  }
} finally {
  rmSync(refreshDir, { force: true, recursive: true })
}
