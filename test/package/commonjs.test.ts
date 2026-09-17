/**
 * Loads the built CommonJS entry the way a require() consumer does. `npm test`
 * builds `dist/` first.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

const PROBE = `
const pixi = require('pixi.js')
const { loadMapBlendModes } = require('./dist/index.cjs')
let blendModes = 0
const add = pixi.extensions.add
pixi.extensions.add = function (...extensions) {
  for (const extension of extensions) {
    if (extension.extension?.type === pixi.ExtensionType.BlendMode) blendModes++
  }
  return add.apply(this, extensions)
}
loadMapBlendModes({ layers: [{ type: 'group', mode: 'overlay', layers: [] }] }).then(
  () => console.log(JSON.stringify({ blendModes })),
  (error) => {
    console.error(error)
    process.exit(1)
  }
)
`

describe('CommonJS build', () => {
  it('registers advanced blend modes with the required PixiJS instance', () => {
    const result = spawnSync(process.execPath, ['-e', PROBE], {
      cwd: repoRoot,
      encoding: 'utf8'
    })

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout).blendModes).toBeGreaterThan(0)
  })
})
