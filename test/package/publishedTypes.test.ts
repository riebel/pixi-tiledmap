/**
 * Type-checks the files `npm pack` would publish, the way consumers resolve
 * them. The build emits declarations through TypeScript's native compiler,
 * whose API tsdown still calls experimental, so this pins the published types
 * against silent changes. `npm test` builds `dist/` first.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
// Inside the repo's node_modules, so consumers resolve pixi.js from the repo.
const workRoot = join(repoRoot, 'node_modules/.cache/published-types')
const tscBin = join(repoRoot, 'node_modules/typescript/bin/tsc')
const PACKAGE_PATH = /[\\/]node_modules[\\/]pixi-tiledmap[\\/]/
const LOCATED_DIAGNOSTIC = /^\S+\(\d+,\d+\): /

const ESM_CONSUMER = `import {
  createMap,
  exportMap,
  getProperty,
  parseMap,
  parseTsx,
  TiledMap,
  type TiledMapAsset,
  type TiledTileset,
  type TileCell,
  tileAt,
  tiledMapLoader
} from 'pixi-tiledmap'

const map = createMap({ width: 2, height: 2, tilewidth: 16, tileheight: 16 })
const reparsed = parseMap(exportMap(map))
const cell: TileCell | null = tileAt(reparsed, 0, 0)
const theme: string | undefined = getProperty(reparsed, 'theme', 'string')
const tileset: TiledTileset = parseTsx('<tileset/>')
const view = new TiledMap(reparsed)
const asset: TiledMapAsset = { mapData: reparsed, container: view }
const loaderName: string = tiledMapLoader.name ?? ''
view.clearTile('ground', 0, 0)

// @ts-expect-error map sizes are numbers
createMap({ width: '2', height: 2, tilewidth: 16, tileheight: 16 })
// @ts-expect-error parseMap takes Tiled map data
parseMap(42)
// @ts-expect-error a narrowed string property is not a number
const wrongTheme: number | undefined = getProperty(reparsed, 'theme', 'string')
// @ts-expect-error the container is a TiledMap, not any
const wrongView: string = asset.container

export { cell, loaderName, theme, tileset, wrongTheme, wrongView }
`

const CJS_CONSUMER = `import tiled = require('pixi-tiledmap')

const map: tiled.ResolvedMap = tiled.createMap({ width: 1, height: 1, tilewidth: 8, tileheight: 8 })
const cell: tiled.TileCell | null = tiled.tileAt(map, 0, 0)

// @ts-expect-error exportMap takes a resolved map
tiled.exportMap('map')

export = { cell }
`

interface Consumer {
  moduleResolution: 'nodenext' | 'node16' | 'bundler'
  files: Record<string, string>
}

const consumers: Consumer[] = [
  {
    moduleResolution: 'nodenext',
    files: { 'esm.mts': ESM_CONSUMER, 'cjs.cts': CJS_CONSUMER }
  },
  {
    moduleResolution: 'node16',
    files: { 'esm.mts': ESM_CONSUMER, 'cjs.cts': CJS_CONSUMER }
  },
  {
    moduleResolution: 'bundler',
    files: { 'consumer.ts': ESM_CONSUMER }
  }
]

/** Copies exactly the files `npm pack` would publish into a consumer install. */
function installPackedFiles(): void {
  const pack = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })
  expect(pack.status, pack.stderr).toBe(0)

  const report = JSON.parse(pack.stdout) as
    | { files: { path: string }[] }[]
    | Record<string, { files: { path: string }[] }>
  const entry = Array.isArray(report) ? report[0] : Object.values(report)[0]
  const target = join(workRoot, 'node_modules/pixi-tiledmap')

  // Its own package scope, or 'pixi-tiledmap' self-resolves to this repository
  // instead of the copied install.
  mkdirSync(workRoot, { recursive: true })
  writeFileSync(
    join(workRoot, 'package.json'),
    JSON.stringify({ name: 'published-types-consumer', private: true })
  )

  for (const { path } of entry!.files) {
    mkdirSync(dirname(join(target, path)), { recursive: true })
    cpSync(join(repoRoot, path), join(target, path))
  }
}

interface TypecheckResult {
  errors: string[]
  loadedDeclarations: string[]
}

function typecheck(consumer: Consumer): TypecheckResult {
  const dir = join(workRoot, consumer.moduleResolution)
  const fileNames = Object.keys(consumer.files)
  mkdirSync(dir, { recursive: true })
  for (const [name, source] of Object.entries(consumer.files)) {
    writeFileSync(join(dir, name), source)
  }

  const bundler = consumer.moduleResolution === 'bundler'
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: bundler ? 'esnext' : consumer.moduleResolution,
        moduleResolution: consumer.moduleResolution,
        target: 'es2022',
        lib: ['es2022', 'dom'],
        types: [],
        strict: true,
        noEmit: true,
        skipLibCheck: false
      },
      files: fileNames
    })
  )

  // Run inside the consumer so reported paths are relative to it.
  const result = spawnSync(
    process.execPath,
    [tscBin, '-p', '.', '--pretty', 'false', '--listFiles'],
    {
      cwd: dir,
      encoding: 'utf8'
    }
  )
  expect(result.error).toBeUndefined()
  const lines = `${result.stdout}${result.stderr}`.split(/\r?\n/)

  return {
    // PixiJS' own declarations can clash with the DOM lib; only errors in the
    // consumer files, in this package, or without a location are ours.
    errors: lines
      .filter((line) => /error TS\d+/.test(line))
      .filter(
        (line) =>
          !LOCATED_DIAGNOSTIC.test(line) ||
          PACKAGE_PATH.test(line) ||
          fileNames.some((name) => line.startsWith(`${name}(`))
      ),
    loadedDeclarations: lines
      .filter((line) => PACKAGE_PATH.test(line) && /\.d\.[cm]ts$/.test(line))
      .map((line) => line.split(PACKAGE_PATH).pop()!.replaceAll('\\', '/'))
  }
}

describe('published type declarations', () => {
  beforeAll(() => {
    rmSync(workRoot, { recursive: true, force: true })
    installPackedFiles()
  }, 60_000)

  it.each(consumers)(
    'type-check for $moduleResolution consumers',
    (consumer) => {
      const { errors, loadedDeclarations } = typecheck(consumer)

      expect(errors).toEqual([])
      expect(loadedDeclarations).toContain('dist/index.d.mts')
      if (consumer.moduleResolution !== 'bundler') {
        expect(loadedDeclarations).toContain('dist/index.d.cts')
      }
    },
    60_000
  )
})
