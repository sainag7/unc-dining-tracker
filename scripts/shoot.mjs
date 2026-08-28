/**
 * Screenshots a route in both themes, at phone width.
 *
 * The design work is matched against reference images, and "looks right in my
 * head" is not a check. This drives headless Chrome over CDP directly rather
 * than adding Playwright: the app has no UI dependencies and this needs about
 * sixty lines of protocol, most of it waiting for a load event.
 *
 *   node scripts/shoot.mjs [path] [outDir] [width]
 *
 * Theme comes from next-themes' localStorage key, set before the app's
 * no-flash script runs. Emulation.setEmulatedMedia matches prefers-color-scheme
 * to it so the two can't disagree on first paint.
 */

const PATH = process.argv[2] ?? '/';
const OUT_DIR = process.argv[3] ?? 'shots';
const WIDTH = Number(process.argv[4] ?? 375);
const HEIGHT = 900;
const ORIGIN = 'http://localhost:3000';
const PORT = 9333;

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not expose a debugging port');
}

/** Minimal CDP client: send(method, params) -> result, with session routing. */
function client(ws) {
  let id = 0;
  const pending = new Map();
  const events = [];

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params, sessionId }));
    });

  const waitFor = async (method, timeoutMs = 15000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = events.findIndex((e) => e.method === method);
      if (hit !== -1) return events.splice(hit, 1)[0];
      await sleep(50);
    }
    throw new Error(`timed out waiting for ${method}`);
  };

  return { send, waitFor };
}

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/tray-shots-profile',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  const ws = new WebSocket(await endpoint());
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const { send, waitFor } = client(ws);

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);

  await s('Page.enable');
  await s('Runtime.enable');
  await s('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await mkdir(OUT_DIR, { recursive: true });
  let seeded = null;

  for (const theme of ['dark', 'light']) {
    await s('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: theme }],
    });

    // Seed the theme before any document script runs, including next-themes'
    // no-flash inline. Navigating somewhere on the origin first to set
    // localStorage worked but cost a whole extra page load per theme.
    if (seeded) await s('Page.removeScriptToEvaluateOnNewDocument', { identifier: seeded });
    seeded = (
      await s('Page.addScriptToEvaluateOnNewDocument', {
        source: `try { localStorage.setItem('theme', ${JSON.stringify(theme)}) } catch {}`,
      })
    ).identifier;

    await s('Page.navigate', { url: ORIGIN + PATH });
    await waitFor('Page.loadEventFired');
    // Fonts, the segmented-control indicator measurement, and any sheet
    // animation all settle after load.
    await sleep(1200);

    // Next's dev indicator floats over the bottom-left corner, which is where
    // the tab bar is. It is not part of the design.
    await s('Runtime.evaluate', {
      expression: `document.querySelectorAll('nextjs-portal').forEach((n) => n.remove())`,
    });

    // Viewport-framed, not full-page: the reference images are one phone
    // screen, and a 10,000px scroll capture can't be compared to them.
    const { data } = await s('Page.captureScreenshot', { format: 'png' });
    const name = `${OUT_DIR}/${PATH.replace(/[^a-z0-9]+/gi, '_') || 'root'}-${theme}.png`;
    await writeFile(name, Buffer.from(data, 'base64'));
    console.log(`  ${name}`);
  }

  ws.close();
} finally {
  chrome.kill();
}
