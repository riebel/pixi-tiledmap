/**
 * Headless Chrome plumbing shared by the in-browser measurement scripts: find
 * Chrome, serve a page, and wait for the JSON the page posts to `/results`.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

const CHROME_PATHS = {
  win32: [
    join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe')
  ],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
}

/** Page source defining `postResults(value)`, which hands a result to `measureInChrome`. */
export const resultsPosterSource = `
function postResults(value) {
  return fetch('/results', { method: 'POST', body: JSON.stringify(value) });
}`

export function readCount(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  const count = Number(raw)
  if (Number.isInteger(count) && count > 0) return count
  throw new Error(`${name} must be a positive integer, got ${raw}`)
}

/**
 * Serves `routes` (pathname to `{ type, body() }`) on a free port, loads `/`
 * in headless Chrome, and returns what the page passes to `postResults`.
 * Chrome renders through SwiftShader unless `gpu` is set.
 */
export async function measureInChrome(routes, { gpu }) {
  let received
  const results = new Promise((done) => {
    received = done
  })
  const server = await startServer(routes, received)
  const chrome = launchChrome(`http://127.0.0.1:${server.port}/`, gpu)
  try {
    return JSON.parse(await Promise.race([results, chrome.exited]))
  } finally {
    chrome.process.kill()
    await new Promise((done) => server.instance.close(done))
  }
}

function launchChrome(url, gpu) {
  const flags = [
    '--headless=new',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1024,1024',
    url
  ]
  if (!gpu) flags.splice(1, 0, '--disable-gpu')

  const chrome = spawn(findChrome(), flags)
  let stderr = ''
  chrome.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  const exited = new Promise((_, fail) => {
    chrome.on('error', fail)
    chrome.on('close', (code) => {
      fail(new Error(`Chrome exited with status ${code} before the page posted results\n${stderr}`))
    })
  })
  // Killing Chrome once the results are in closes it too; nothing awaits that.
  exited.catch(() => {})
  return { process: chrome, exited }
}

function startServer(routes, onResults) {
  const instance = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    if (pathname === '/results') receiveResults(request, response, onResults)
    else serveRoute(routes[pathname], response)
  })

  return new Promise((done) => {
    instance.listen(0, '127.0.0.1', () => {
      const address = instance.address()
      done({ instance, port: address.port })
    })
  })
}

function receiveResults(request, response, onResults) {
  let body = ''
  request.on('data', (chunk) => {
    body += chunk
  })
  request.on('end', () => {
    response.writeHead(204)
    response.end()
    onResults(body)
  })
}

function serveRoute(route, response) {
  if (!route) {
    response.writeHead(404)
    response.end('Not found')
    return
  }
  response.writeHead(200, { 'content-type': `${route.type}; charset=utf-8` })
  response.end(route.body())
}

/** Mirrors the Chrome lookup of the MagicLand visual test. */
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH

  const candidates = CHROME_PATHS[process.platform] ?? CHROME_PATHS.linux
  const found = candidates.find((candidate) => candidate && existsSync(candidate))
  if (found) return found
  throw new Error('Chrome not found; set CHROME_PATH to a Chrome or Chromium binary.')
}
