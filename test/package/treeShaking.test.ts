/**
 * Bundles single imports from the built package and checks what they pull in.
 * `npm test` builds `dist/` first, so this guards the published module layout:
 * data-side APIs must bundle without PixiJS, and the XML parsers without the
 * GIF plugin.
 */
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'

const packageEntry = fileURLToPath(new URL('../../dist/index.mjs', import.meta.url)).replaceAll(
  '\\',
  '/'
)
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

/** Every PixiJS module the bundle loads, including bare side-effect imports. */
function pixiImports(code: string): string[] {
  const specifiers = code.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'](pixi\.js[^"']*)["']/g)
  return [...new Set([...specifiers].map((match) => match[1]!))].sort()
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

    expect(pixiImports(code)).toEqual(['pixi.js', 'pixi.js/gif'])
    // Match the call shape rather than exact local names, which a bundler may rename.
    expect(code).toMatch(/\.add\(\s*[\w$]*GifAsset[\w$]*\s*\)/)
  })
})
