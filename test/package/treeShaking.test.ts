/**
 * Bundles single imports from the built package and checks what they pull in.
 * `npm test` builds `dist/` first, so this guards the published module layout:
 * data-side APIs must bundle without PixiJS, and the XML parsers without the
 * GIF plugin.
 */
import { resolve } from 'node:path'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'

const packageEntry = resolve(import.meta.dirname, '../../dist/index.mjs').replaceAll('\\', '/')
const ENTRY_ID = 'virtual:tree-shaking-entry'

async function bundleImport(names: string[]): Promise<string> {
  const code = `import { ${names.join(', ')} } from '${packageEntry}'\nconsole.log(${names.join(', ')})\n`
  const bundle = await rolldown({
    input: ENTRY_ID,
    external: [/^pixi\.js/],
    logLevel: 'silent',
    plugins: [
      {
        name: 'tree-shaking-entry',
        resolveId: (id) => (id === ENTRY_ID ? `\0${ENTRY_ID}` : null),
        load: (id) => (id === `\0${ENTRY_ID}` ? code : null)
      }
    ]
  })
  const { output } = await bundle.generate({ format: 'esm' })
  await bundle.close()
  return output[0].code
}

function pixiImports(code: string): string[] {
  return [...code.matchAll(/from ["'](pixi\.js[^"']*)["']/g)].map((match) => match[1]!)
}

describe('tree shaking of the built package', () => {
  it.each([
    ['parseMap', 'parseMapAsync'],
    ['exportMap', 'exportTileset', 'encodeGid', 'decodeGid'],
    ['createMap', 'createTileset', 'createTileLayer', 'createObjectLayer'],
    ['findLayer', 'findLayerById', 'walkLayers', 'getProperty'],
    ['tileAt', 'pixelToTile', 'tileToPixel']
  ])('bundles %s without PixiJS or renderer code', async (...names) => {
    const code = await bundleImport(names)

    expect(pixiImports(code)).toEqual([])
    expect(code).not.toContain('extends Container')
  })

  it('bundles the XML parsers with PixiJS core only', async () => {
    const code = await bundleImport(['parseTmx', 'parseTsx', 'parseTx'])

    expect(pixiImports(code)).toEqual(['pixi.js'])
    expect(code).not.toContain('extends Container')
  })

  it('keeps the GIF loader registration with the asset loader', async () => {
    const code = await bundleImport(['tiledMapLoader'])

    expect(pixiImports(code)).toEqual(expect.arrayContaining(['pixi.js', 'pixi.js/gif']))
    expect(code).toMatch(/extensions\.add\(GifAsset\)/)
  })
})
