// Drives the real demo in headless Chrome over CDP: four bridge clicks, one
// export. Writes one capture per state to frames/ and the exported map to
// frames/export/level-edited.tmj. Run from the repository root after prepare.mjs.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const frames = join(root, 'frames');
const downloads = join(frames, 'export');
const chromePath = join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe');
const port = 9333;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

await rm(downloads, { recursive: true, force: true });
await mkdir(downloads, { recursive: true });

const server = spawn(process.execPath, [join(root, 'serve.mjs')], { stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'roundtrip-chrome-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--hide-scrollbars', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=1100,760', 'about:blank',
]);

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => undefined);
  }
  const socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((done) => socket.addEventListener('open', done, { once: true }));
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { done, fail } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? fail(new Error(message.error.message)) : done(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((done, fail) => {
    const id = ++nextId;
    pending.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
  const shoot = async (name) => {
    await sleep(250);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(frames, name), Buffer.from(data, 'base64'));
  };
  const click = async (x, y) => {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 760, deviceScaleFactor: 1, mobile: false });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4178/' });
  for (let i = 0; i < 100 && !(await evaluate('!!document.querySelector("#map canvas")')); i++) await sleep(100);
  await sleep(1500);

  const layout = await evaluate(`(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
    return { canvas: box(document.querySelector('#map canvas')), button: box(document.querySelector('#export')),
             status: box(document.querySelector('#status')) };
  })()`);
  const [left, top, width, height] = layout.canvas;
  const cell = (col, row) => [left + (col + 0.5) * width / 18, top + (row + 0.5) * height / 10];
  layout.clicks = [7, 8, 9, 10].map((col) => cell(col, 6));

  await shoot('browser-0.png');
  for (const [i, [x, y]] of layout.clicks.entries()) {
    await click(x, y);
    await shoot(`browser-${i + 1}.png`);
  }
  const [bx, by, bw, bh] = layout.button;
  await click(bx + bw / 2, by + bh / 2);
  await shoot('browser-export.png');
  for (let i = 0; i < 50 && !(await readdir(downloads)).includes('level-edited.tmj'); i++) await sleep(100);
  await writeFile(join(frames, 'browser-layout.json'), JSON.stringify(layout, null, 2));
  console.log('captured', layout);
  socket.close();
} finally {
  chrome.kill();
  server.kill();
  await sleep(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
