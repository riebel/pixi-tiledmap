import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const fallowCli = resolve('node_modules/fallow/bin/fallow')
const analyses = [
  ['dead-code', 'quality/fallow/dead-code.json'],
  ['health', 'quality/fallow/health.json'],
  ['dupes', 'quality/fallow/dupes.json']
]

for (const [analysis, baseline] of analyses) {
  const result = spawnSync(
    process.execPath,
    [
      fallowCli,
      analysis,
      '--baseline',
      resolve(baseline),
      '--fail-on-issues',
      '--format',
      'compact',
      '--quiet'
    ],
    { encoding: 'utf8' }
  )

  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
}

console.log('Fallow gate passed (dead-code, health, dupes).')
