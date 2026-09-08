// REPL driver for grimoire.html (Storyteller's Grimoire). Plain static
// HTML/JS/CSS, no build step, no framework — driven with a normal
// Playwright `chromium.launch()` page, not an Electron `_electron` app.
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
//
// Serves the repo root over a tiny built-in static server rather than
// file://, because python -m http.server (the obvious alternative) omits
// `charset=utf-8` on its Content-Type header, which makes Chromium
// mis-decode the file's embedded emoji/em-dashes as Latin-1 (mojibake).
import { chromium } from 'playwright';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

let server = null, port = null, browser = null, page = null;

function startServer() {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      const filePath = path.join(REPO_ROOT, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => { port = server.address().port; resolve(); });
  });
}

const COMMANDS = {
  // Launches the browser, serves the repo root, and navigates straight to
  // grimoire.html. Pass a query string (e.g. "?seats=15") to land on a
  // different starting state — mainly useful with .scratch/*/prototype.html.
  async launch(arg) {
    if (browser) return console.log('already launched');
    if (!server) await startServer();
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
    page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/${arg || 'grimoire.html'}`);
    console.log('launched. serving', REPO_ROOT, 'on port', port);
  },

  async nav(urlPath) {
    if (!page) return console.log('ERROR: launch first');
    await page.goto(`http://127.0.0.1:${port}/${urlPath}`);
    console.log('navigated to', urlPath);
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.click(sel, { timeout: 5000 }); console.log('click', sel, '→ OK'); }
    catch (e) { console.log('click', sel, '→ FAILED:', e.message.split('\n')[0]); }
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, a, [role="button"], .tab')];
      const el = els.find(e => e.textContent?.trim() === t) ?? els.find(e => e.textContent?.includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName;
    }, text);
    console.log('click-text', JSON.stringify(text), '→', r);
  },

  async fill(rest) {
    if (!page) return console.log('ERROR: launch first');
    const sp = rest.indexOf(' ');
    const [sel, value] = sp === -1 ? [rest, ''] : [rest.slice(0, sp), rest.slice(sp + 1)];
    await page.fill(sel, value);
    console.log('fill', sel, '→', JSON.stringify(value));
  },

  async type(text) { if (page) await page.keyboard.type(text, { delay: 20 }); },
  async press(key) { if (page) await page.keyboard.press(key); },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(s => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)', sel || null));
  },

  // ---- App-specific commands (Table mode / Circular Grimoire Layout) ----

  // new-game Alex,Bri,Cass,Deja — opens the Table tab, starts the setup
  // flow, and seats one Player per comma-separated name (in order).
  async 'new-game'(namesCsv) {
    if (!page) return console.log('ERROR: launch first');
    await page.click('.tab[data-tab="table"]');
    await page.click('#table-start-btn').catch(() => {});
    await page.waitForSelector('#seat-name-input', { timeout: 5000 });
    for (const name of namesCsv.split(',').map(s => s.trim()).filter(Boolean)) {
      await page.fill('#seat-name-input', name);
      await page.press('#seat-name-input', 'Enter');
    }
    console.log('seated:', namesCsv);
  },

  // assign-next [n] — clicks the first still-enabled character-picker
  // button, n times (default 1). Assigning auto-advances to the next
  // unassigned seat, so calling this once per seat walks the whole roster.
  async 'assign-next'(nArg) {
    if (!page) return console.log('ERROR: launch first');
    const n = Number(nArg) || 1;
    for (let i = 0; i < n; i++) {
      await page.locator('.picker-btn:not([disabled])').first().click();
    }
    console.log('assigned', n, 'seat(s)');
  },

  // assign-char Washerwoman — assigns one specific Character by name
  // (data-char attribute) to the active seat, for team-diverse setups.
  async 'assign-char'(name) {
    if (!page) return console.log('ERROR: launch first');
    await page.click(`.picker-btn[data-char="${name}"]`);
    console.log('assigned', name);
  },

  async 'start-game'() {
    if (!page) return console.log('ERROR: launch first');
    await page.click('#setup-start-btn');
    await page.waitForSelector('.view-toggle-btn', { timeout: 5000 });
    console.log('game started');
  },

  // Cycles Table → Grimoire → Town Square → Table.
  async 'toggle-view'() {
    if (!page) return console.log('ERROR: launch first');
    const next = await page.evaluate(() => {
      const order = ['table', 'grimoire', 'town'];
      const active = document.querySelector('.view-toggle-btn.is-active');
      const idx = order.indexOf(active ? active.dataset.view : 'table');
      const nextView = order[(idx + 1) % order.length];
      document.querySelector(`.view-toggle-btn[data-view="${nextView}"]`).click();
      return nextView;
    });
    console.log('switched to view:', next);
  },

  // set-view table|grimoire|town — jump straight to one view.
  async 'set-view'(view) {
    if (!page) return console.log('ERROR: launch first');
    await page.click(`.view-toggle-btn[data-view="${view}"]`);
    console.log('view set to', view);
  },

  // kill-seat 3 — selects seat N in the live Table view and flips it dead.
  async 'kill-seat'(seat) {
    if (!page) return console.log('ERROR: launch first');
    await page.click(`.live-seat-row[data-seat="${seat}"]`);
    await page.click('#detail-alive-toggle');
    console.log('toggled alive/dead for seat', seat);
  },

  // drag-seat 1 220 120 — drags Circular-Grimoire-Layout seat 1's card by
  // (dx, dy) pixels. Position is written to the Game object on drop.
  async 'drag-seat'(rest) {
    if (!page) return console.log('ERROR: launch first');
    const [seat, dx, dy] = rest.split(/\s+/);
    const card = page.locator(`.circ-card[data-seat="${seat}"]`);
    const box = await card.boundingBox();
    if (!box) return console.log('NOT_FOUND: seat', seat);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + Number(dx), box.y + Number(dy), { steps: 12 });
    await page.mouse.up();
    const pos = await card.evaluate(el => ({ left: el.style.left, top: el.style.top }));
    console.log('dragged seat', seat, '→', pos);
  },

  async 'reset-positions'() {
    if (!page) return console.log('ERROR: launch first');
    await page.click('#circ-reset-btn');
    console.log('reset circular positions');
  },

  // theme dark|light — emulateMedia's colorScheme, since this app has no
  // in-page theme toggle, only prefers-color-scheme.
  async theme(scheme) {
    if (!page) return console.log('ERROR: launch first');
    await page.emulateMedia({ colorScheme: scheme });
    console.log('theme →', scheme);
  },

  async 'clear-game'() {
    if (!page) return console.log('ERROR: launch first');
    await page.evaluate(() => localStorage.removeItem('botc-grimoire-game'));
    console.log('cleared localStorage Game state');
  },

  async quit() {
    if (browser) await browser.close().catch(() => {});
    if (server) server.close();
    browser = null; page = null; server = null;
  },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async line => {
  const trimmed = line.trim();
  const sp = trimmed.indexOf(' ');
  const cmd = sp === -1 ? trimmed : trimmed.slice(0, sp);
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '— try: help'); return rl.prompt(); }
  try { await fn(rest); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('grimoire.html driver — "help" for commands, "launch" to start');
rl.prompt();
