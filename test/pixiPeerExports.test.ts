import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { collectPixiValueImports } from './helpers/pixiImports'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const peerExports = JSON.parse(
  readFileSync(join(root, 'test', 'fixtures', 'pixiPeerExports-8.10.0.json'), 'utf8')
) as { version: string; exports: Record<string, string[]> }
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  peerDependencies: Record<string, string>
}

describe('pixi.js peer range', () => {
  const imports = collectPixiValueImports(join(root, 'src'), '.ts')

  it('checks the export list of the lowest supported pixi.js', () => {
    expect(packageJson.peerDependencies['pixi.js']).toBe(`>=${peerExports.version}`)
  })

  it('imports only pixi.js entries with a recorded export list', () => {
    expect([...imports.keys()].sort()).toEqual(['pixi.js', 'pixi.js/gif'])
    expect(Object.keys(peerExports.exports).sort()).toEqual(['pixi.js', 'pixi.js/gif'])
  })

  it(`imports only names that pixi.js ${peerExports.version} exports`, () => {
    const missing: string[] = []
    for (const [specifier, names] of imports) {
      const available = new Set(peerExports.exports[specifier])
      for (const [name, files] of names) {
        if (!available.has(name)) missing.push(`${name} from ${specifier} (${files.join(', ')})`)
      }
    }

    expect(
      missing,
      `pixi.js ${peerExports.version} lacks these imports: a missing named export fails ESM linking ` +
        'and webpack builds. Use an API that version has, or raise the peer range in the release notes.'
    ).toEqual([])
  })
})

describe('collectPixiValueImports', () => {
  it('records value bindings under their exported names and skips type-only ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pixi-imports-'))
    try {
      writeFileSync(
        join(dir, 'a.ts'),
        [
          "import { helper } from './helper'",
          'import {',
          '  Container,',
          '  type Texture,',
          '  path as pixiPath',
          "} from 'pixi.js'",
          "import type { GifSource } from 'pixi.js/gif'",
          "import { type GifAsset, GifSprite } from 'pixi.js/gif'",
          "import 'pixi.js/advanced-blend-modes'",
          "const lazy = import('pixi.js/math-extras')",
          "export { Sprite } from 'pixi.js'"
        ].join('\n')
      )
      writeFileSync(
        join(dir, 'b.ts'),
        "import Pixi, { Container } from 'pixi.js'\nimport * as Gif from 'pixi.js/gif'\n"
      )

      const imports = collectPixiValueImports(dir, '.ts')

      expect(imports).toEqual(
        new Map([
          [
            'pixi.js',
            new Map([
              ['Container', ['a.ts', 'b.ts']],
              ['path', ['a.ts']],
              ['Sprite', ['a.ts']],
              ['default', ['b.ts']]
            ])
          ],
          [
            'pixi.js/gif',
            new Map([
              ['GifSprite', ['a.ts']],
              ['*', ['b.ts']]
            ])
          ]
        ])
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
