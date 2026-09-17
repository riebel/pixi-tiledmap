import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { collectPixiValueImports } from '../helpers/pixiImports'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixtureDir = join(root, 'test', 'fixtures', 'magicland')
const referencePath = join(fixtureDir, 'reference-render-1000x700.png')
const outputDir = join(fixtureDir, '.visual-output')
const actualPath = join(outputDir, 'actual-render-1000x700.png')
const diffPath = join(outputDir, 'diff-render-1000x700.png')
const chromeProfileDir = join(outputDir, 'chrome-profile')

const viewport = process.env.MAGICLAND_VIEWPORT ?? '1000,700'
const { width: viewportWidth, height: viewportHeight } = parseViewport(viewport)
const maxDiffPixels = Number(process.env.MAGICLAND_MAX_DIFF_PIXELS ?? '3500')

// The page loads PixiJS as UMD globals and maps each specifier to a generated shim.
const pixiShimRoutes = {
  'pixi.js': '/shims/pixi.mjs',
  'pixi.js/gif': '/shims/pixi-gif.mjs'
}
const fixturePagePixiImports = ['Application', 'Assets', 'extensions']

describe('MagicLand visual render', () => {
  it('matches the checked-in visual reference headlessly', async () => {
    mkdirSync(outputDir, { recursive: true })
    rmSync(actualPath, { force: true })
    rmSync(diffPath, { force: true })
    rmSync(chromeProfileDir, { recursive: true, force: true })

    const server = await startFixtureServer()
    try {
      await runChromeCapture(`http://127.0.0.1:${server.port}/`)
      const { diffPixels, totalPixels } = compareScreenshot()
      expect(diffPixels).toBeLessThanOrEqual(maxDiffPixels)
      console.log(
        `MagicLand visual check: ${diffPixels}/${totalPixels} pixels differ ` +
          `(${((diffPixels / totalPixels) * 100).toFixed(3)}%).`
      )
    } finally {
      await new Promise<void>((resolveClose) => server.instance.close(() => resolveClose()))
      rmSync(chromeProfileDir, { recursive: true, force: true })
    }
  }, 60_000)
})

function compareScreenshot(): { diffPixels: number; totalPixels: number } {
  if (!existsSync(actualPath)) {
    throw new Error(`Chrome did not write a screenshot at ${actualPath}`)
  }

  const reference = PNG.sync.read(readFileSync(referencePath))
  const actual = PNG.sync.read(readFileSync(actualPath))

  if (reference.width !== actual.width || reference.height !== actual.height) {
    throw new Error(
      `Screenshot size mismatch: expected ${reference.width}x${reference.height}, got ${actual.width}x${actual.height}`
    )
  }

  const diff = new PNG({ width: reference.width, height: reference.height })
  const diffPixels = pixelmatch(
    reference.data,
    actual.data,
    diff.data,
    reference.width,
    reference.height,
    { threshold: 0.1 }
  )
  writeFileSync(diffPath, PNG.sync.write(diff))

  return {
    diffPixels,
    totalPixels: reference.width * reference.height
  }
}

function runChromeCapture(url: string): Promise<void> {
  return new Promise((resolveCapture, rejectCapture) => {
    const chrome = spawn(findChrome(), [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--user-data-dir=${chromeProfileDir}`,
      `--window-size=${viewport}`,
      '--virtual-time-budget=5000',
      `--screenshot=${actualPath}`,
      url
    ])

    let stdout = ''
    let stderr = ''
    chrome.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    chrome.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    chrome.on('error', rejectCapture)
    chrome.on('close', (code) => {
      if (code === 0) {
        resolveCapture()
        return
      }
      rejectCapture(new Error(`Chrome exited with status ${code}\n${stdout}\n${stderr}`))
    })
  })
}

function startFixtureServer(): Promise<{ instance: Server; port: number }> {
  const pixiShims = renderPixiShims()
  const instance = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')

      if (requestUrl.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(renderFixturePage())
        return
      }

      const shim = pixiShims.get(requestUrl.pathname)
      if (shim !== undefined) {
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
        response.end(shim)
        return
      }

      const file = resolveStaticPath(requestUrl.pathname)
      if (!file) {
        response.writeHead(404)
        response.end('Not found')
        return
      }

      response.writeHead(200, { 'content-type': contentType(file) })
      response.end(readFileSync(file))
    } catch (error) {
      response.writeHead(500)
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  return new Promise((resolveServer) => {
    instance.listen(0, '127.0.0.1', () => {
      const address = instance.address()
      if (!address || typeof address === 'string') {
        throw new Error('Unable to bind visual fixture server')
      }
      resolveServer({ instance, port: address.port })
    })
  })
}

function renderFixturePage(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; width: ${viewportWidth}px; height: ${viewportHeight}px; overflow: hidden; background: rgb(26, 26, 46); }
      canvas { display: block; width: ${viewportWidth}px; height: ${viewportHeight}px; }
    </style>
    <script src="/node_modules/pixi.js/dist/pixi.js"></script>
    <script src="/node_modules/pixi.js/dist/packages/gif.js"></script>
    <script type="importmap">${JSON.stringify({ imports: pixiShimRoutes })}</script>
  </head>
  <body>
    <script type="module">
      import { ${fixturePagePixiImports.join(', ')} } from 'pixi.js';
      import { tiledMapLoader } from '/dist/index.mjs';

      extensions.add(tiledMapLoader);

      const app = new Application();
      await app.init({ background: '#1099bb', width: ${viewportWidth}, height: ${viewportHeight} });
      document.body.appendChild(app.canvas);

      const { container } = await Assets.load('/fixtures/magicland/MagicLand.tmx');
      app.stage.addChild(container);
    </script>
  </body>
</html>`
}

function parseViewport(value: string): { width: number; height: number } {
  const [rawWidth, rawHeight] = value.split(',').map((part) => Number(part))
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) {
    throw new Error(`Invalid MAGICLAND_VIEWPORT value: ${value}`)
  }
  return { width: rawWidth, height: rawHeight }
}

/**
 * Serves each `pixi.js` entry the page and `dist/` import as a module that
 * re-exports the matching name from the UMD globals loaded by the page.
 */
function renderPixiShims(): Map<string, string> {
  const imports = collectPixiValueImports(join(root, 'dist'), '.mjs')
  const pageNames = imports.get('pixi.js') ?? new Map<string, string[]>()
  for (const name of fixturePagePixiImports) pageNames.set(name, ['fixture page'])
  imports.set('pixi.js', pageNames)

  const shims = new Map<string, string>()
  for (const [specifier, names] of imports) {
    if (!(specifier in pixiShimRoutes)) {
      throw new Error(
        `dist/ imports ${specifier}; add it to pixiShimRoutes and the page import map`
      )
    }
    const lines = ['const PIXI = globalThis.PIXI;']
    for (const name of [...names.keys()].sort()) {
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
        throw new Error(`The PixiJS shim cannot serve the ${name} binding of ${specifier}`)
      }
      lines.push(`export const ${name} = PIXI.${name};`)
    }
    shims.set(pixiShimRoutes[specifier as keyof typeof pixiShimRoutes], lines.join('\n'))
  }
  return shims
}

function resolveStaticPath(pathname: string): string | null {
  const routes = [
    ['/dist/', join(root, 'dist')],
    ['/node_modules/', join(root, 'node_modules')],
    ['/fixtures/magicland/', fixtureDir]
  ] as const

  for (const [prefix, base] of routes) {
    if (!pathname.startsWith(prefix)) continue

    const relative = decodeURIComponent(pathname.slice(prefix.length))
    const resolved = resolve(base, relative)
    if (resolved === base) return null
    if (!isInside(resolved, base)) return null
    return existsSync(resolved) ? resolved : null
  }

  return null
}

function isInside(file: string, base: string): boolean {
  const normalizedFile = file.toLowerCase()
  const normalizedBase = base.toLowerCase()
  return (
    normalizedFile.startsWith(`${normalizedBase}\\`) ||
    normalizedFile.startsWith(`${normalizedBase}/`)
  )
}

function contentType(file: string): string {
  if (file.endsWith('.mjs') || file.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.tmx')) return 'text/xml; charset=utf-8'
  if (file.endsWith('.gif')) return 'image/gif'
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.json') || file.endsWith('.map')) return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

function findChrome(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH

  const candidates =
    process.platform === 'win32'
      ? [
          join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          join(
            process.env['PROGRAMFILES(X86)'] ?? '',
            'Google',
            'Chrome',
            'Application',
            'chrome.exe'
          ),
          join(process.env.PROGRAMFILES ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          join(
            process.env['PROGRAMFILES(X86)'] ?? '',
            'Microsoft',
            'Edge',
            'Application',
            'msedge.exe'
          )
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
          ]
        : [
            'google-chrome',
            'google-chrome-stable',
            'chromium',
            'chromium-browser',
            'microsoft-edge'
          ]

  for (const candidate of candidates) {
    if (
      candidate &&
      (candidate.includes('/') || candidate.includes('\\')) &&
      existsSync(candidate)
    ) {
      return candidate
    }
    if (candidate && !(candidate.includes('/') || candidate.includes('\\'))) {
      const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
      if (result.status === 0) return candidate
    }
  }

  throw new Error(
    'Chrome/Edge was not found. Set CHROME_PATH to a headless-capable browser binary.'
  )
}
