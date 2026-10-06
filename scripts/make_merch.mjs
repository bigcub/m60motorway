// Draws the merch artwork into merch/: the ring map and the stacked junction
// names, as transparent PNGs for t-shirts (4500 × 5400, 15 × 18 in at 300 dpi)
// and 11oz mug wraps (2475 × 1155), in a light ink for pale products and a dark
// ink for dark ones, plus mockups to choose from. The map is drawn from
// data/geo.js, so it is the same OpenStreetMap geometry as the site.
//
// Uses the Playwright that ships with the environment's Chromium:
//   node scripts/make_merch.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'merch');
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const { chromium } = await import(pathToFileURL(join(globalModules, 'playwright/index.mjs')).href);

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(ROOT, 'data/geo.js'), 'utf8'), sandbox);
const GEO = sandbox.window.GEO;

// the site's palette: light ink for white and natural products, dark ink for dark ones
const INKS = {
  light: { ink: '#2f3b35', muted: '#6c776f', route: '#a4606b', spur: '#cdb9a3', gold: '#d99a3e', goldInk: '#3a2a10', fill: '#fbf9f4' },
  dark: { ink: '#ece9dd', muted: '#9ba7a1', route: '#cf95a1', spur: '#6b7a83', gold: '#e8b25c', goldInk: '#2a1d08', fill: '#1a2428' },
};
const FONTS = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=block';

const CTR = { x: GEO.ctr[0], y: GEO.ctr[1] };
const CL = GEO.cl.map(([x, y]) => ({ x, y }));
const ringPath = 'M' + CL.map((p) => `${p.x},${p.y}`).join('L') + 'Z';
const J = GEO.J;
const MOTORWAYS = new Set([4, 12, 15, 18, 24]) // as MOTORWAY_JUNCTIONS in src/render.js;

// Tokens sit just outside the ring on a short leader, pushed apart so none overlap.
function placeTokens(r, out, gap) {
  const t = J.map((j) => {
    const dx = j.x - CTR.x, dy = j.y - CTR.y, d = Math.hypot(dx, dy);
    return { n: j.n, ax: j.x, ay: j.y, ux: dx / d, uy: dy / d, x: j.x + (dx / d) * out, y: j.y + (dy / d) * out };
  });
  const min = 2 * r + gap;
  for (let it = 0; it < 400; it++) {
    for (let a = 0; a < t.length; a++) for (let b = a + 1; b < t.length; b++) {
      const A = t[a], B = t[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < min) {
        const push = (min - d) / 2, px = (dx / d) * push, py = (dy / d) * push;
        A.x -= px; A.y -= py; B.x += px; B.y += py;
      }
    }
    // keep each token outside the ring and near its own junction
    for (const T of t) {
      const tx = T.ax + T.ux * out, ty = T.ay + T.uy * out;
      T.x += (tx - T.x) * 0.05; T.y += (ty - T.y) * 0.05;
      const o = (T.x - T.ax) * T.ux + (T.y - T.ay) * T.uy;
      if (o < out * 0.8) { T.x += T.ux * (out * 0.8 - o); T.y += T.uy * (out * 0.8 - o); }
    }
  }
  return t;
}

const STUB = 70; // how far the joining motorways run past the ring

// The full ring: the M60 in rose, the motorways that meet it fading out, and all 27 junctions.
function mapSVG(c, { title = true, sel = 1 } = {}) {
  const r = 15, toks = placeTokens(r, 40, 5);
  const spurs = Object.values(GEO.spurs).join('');
  // the roads that meet the ring are cut to short stubs, each labelled at its end
  const ringR = (a) => Math.max(...CL.filter((p) => Math.abs(Math.atan2(p.y - CTR.y, p.x - CTR.x) - a) < 0.2).map((p) => Math.hypot(p.x - CTR.x, p.y - CTR.y)), 300);
  const labels = GEO.spurLabels.map(([name, x, y]) => {
    const a = Math.atan2(y - CTR.y, x - CTR.x), d = Math.hypot(x - CTR.x, y - CTR.y);
    if (d < ringR(a)) return { name, x, y, inside: true };
    const k = (ringR(a) + STUB + 22) / d;
    return { name, x: CTR.x + (x - CTR.x) * k, y: CTR.y + (y - CTR.y) * k };
  });
  const xs = [...toks.map((t) => t.x), ...labels.map((l) => l.x - 30), ...labels.map((l) => l.x + 30)];
  const ys = [...toks.map((t) => t.y), ...labels.map((l) => l.y - 14), ...labels.map((l) => l.y + 14)];
  const pad = 28;
  const x0 = Math.min(...xs) - r - pad, x1 = Math.max(...xs) + r + pad;
  const y0 = Math.min(...ys) - r - pad, y1 = Math.max(...ys) + r + pad;
  const W = x1 - x0, mapH = y1 - y0, H = mapH + (title ? 250 : 0);
  const reach = Math.max(...CL.map((p) => Math.hypot(p.x - CTR.x, p.y - CTR.y))) + STUB;
  const mtl = J.find((j) => j.n === sel);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${W} ${H}">
  <defs>
    <radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="${CTR.x}" cy="${CTR.y}" r="${reach}">
      <stop offset="0.86" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
    </radialGradient>
    <mask id="spurMask" maskUnits="userSpaceOnUse" x="${x0}" y="${y0}" width="${W}" height="${H}">
      <rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#fade)"/>
      ${toks.map((t) => `<circle cx="${t.x}" cy="${t.y}" r="${r + 6}" fill="#000"/>`).join('')}
      ${labels.map((l) => `<rect x="${l.x - 30}" y="${l.y - 13}" width="60" height="26" rx="13" fill="#000"/>`).join('')}
    </mask>
  </defs>
  <g mask="url(#spurMask)"><path d="${spurs}" fill="none" stroke="${c.spur}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>
  ${labels.map((l) => `<g transform="translate(${l.x} ${l.y})"><rect x="-27" y="-11" width="54" height="22" rx="11" fill="none" stroke="${c.muted}" stroke-width="1.6"/><text y="4.6" text-anchor="middle" font-family="DM Sans" font-weight="600" font-size="13" letter-spacing="0.6" fill="${c.muted}">${l.name}</text></g>`).join('')}
  <circle cx="${GEO.places.Manchester[0]}" cy="${GEO.places.Manchester[1]}" r="6" fill="none" stroke="${c.muted}" stroke-width="2"/>
  <circle cx="${GEO.places.Manchester[0]}" cy="${GEO.places.Manchester[1]}" r="2" fill="${c.muted}"/>
  <text x="${GEO.places.Manchester[0]}" y="${GEO.places.Manchester[1] - 16}" text-anchor="middle" font-family="Lora" font-style="italic" font-size="26" fill="${c.muted}">Manchester</text>
  <path d="${ringPath}" fill="none" stroke="${c.route}" stroke-width="13" stroke-linejoin="round"/>
  ${toks.map((t) => `<line x1="${t.ax}" y1="${t.ay}" x2="${t.x - t.ux * r}" y2="${t.y - t.uy * r}" stroke="${c.muted}" stroke-width="1.6"/>`).join('')}
  ${J.map((j) => `<circle cx="${j.x}" cy="${j.y}" r="3.2" fill="${c.fill}" stroke="${c.ink}" stroke-width="1.6"/>`).join('')}
  ${toks.map((t) => {
    const gold = t.n === mtl.n, mw = MOTORWAYS.has(t.n);
    const fill = gold ? c.gold : mw ? c.ink : 'none', ink = gold ? c.goldInk : mw ? c.fill : c.ink;
    return `<circle cx="${t.x}" cy="${t.y}" r="${r}" fill="${fill}" stroke="${gold ? c.gold : c.ink}" stroke-width="2"/><text x="${t.x}" y="${t.y + 5.4}" text-anchor="middle" font-family="DM Sans" font-weight="600" font-size="15" fill="${ink}">${t.n}</text>`;
  }).join('')}
  ${title ? `<g transform="translate(${x0 + W / 2} ${y1 + 40})" text-anchor="middle">
    <text y="105" font-family="Lora" font-weight="500" font-size="120" fill="${c.ink}">The M60</text>
    <text y="160" font-family="DM Sans" font-weight="500" font-size="22" letter-spacing="5" fill="${c.muted}">MANCHESTER’S OUTER RING · 36.1 MILES · 27 JUNCTIONS</text>
    <text y="200" font-family="DM Sans" font-size="13" letter-spacing="1" fill="${c.muted}">Map data © OpenStreetMap contributors · m60motorway.com</text>
  </g>` : ''}
</svg>`;
}

// A small ring mark, as in the site's icon, with the gold dot at one junction.
function markSVG(c, n, size) {
  const j = J.find((q) => q.n === n);
  const [vx, vy, vw, vh] = GEO.vb;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx - 40} ${vy - 40} ${vw + 80} ${vh + 80}" width="${size}" height="${size}">
  <path d="${ringPath}" fill="none" stroke="${c.route}" stroke-width="70" stroke-linejoin="round"/>
  <circle cx="${j.x}" cy="${j.y}" r="95" fill="${c.gold}"/>
</svg>`;
}

// One word per line, as said out loud, with the junction underneath.
function wordsHTML(c, words, n, maxW, maxH) {
  return `<div class="words" data-w="${maxW}" data-h="${maxH}" style="--s:1">
    ${words.map((w, i) => `<div class="w${i === 0 ? ' first' : ''}">${w}</div>`).join('')}
    <div class="foot">${markSVG(c, n, 120)}<span>M60 · JUNCTION ${n}</span></div>
  </div>`;
}

function pageHTML(c, body, w, h) {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(FONT_CSS).href}"><style>
  html, body { margin: 0; background: transparent; }
  .canvas { width: ${w}px; height: ${h}px; display: flex; align-items: center; justify-content: center; position: relative; }
  .canvas > svg { display: block; }
  .words { display: flex; flex-direction: column; align-items: center; color: ${c.ink}; font-family: Lora; font-weight: 600; line-height: 0.92; }
  .words .w { font-size: calc(var(--s) * 300px); letter-spacing: 0.01em; }
  .words .w.first { color: ${c.route}; font-style: italic; font-weight: 500; }
  .words .foot svg { width: calc(var(--s) * 120px); height: calc(var(--s) * 120px); }
  .words .foot { display: flex; align-items: center; gap: calc(var(--s) * 30px); margin-top: calc(var(--s) * 110px); font: 500 calc(var(--s) * 54px) 'DM Sans'; letter-spacing: 0.24em; color: ${c.muted}; }
  .mug { display: grid; grid-template-columns: 1fr 1fr; width: 100%; height: 100%; }
  .mug > div { display: flex; align-items: center; justify-content: center; }
  </style></head><body><div class="canvas">${body}</div></body></html>`;
}

const DESIGNS = [
  { id: 'ring-map', shirt: (c) => mapSVG(c).replace('<svg ', '<svg width="4100" '), mug: (c) => mapSVG(c, { title: false }).replace('<svg ', '<svg height="1040" ') },
  { id: 'oh-simister-island', words: ['OH', 'SIMISTER', 'ISLAND'], n: 18 },
  { id: 'worsley-braided-interchange', words: ['WORSLEY', 'BRAIDED', 'INTERCHANGE'], n: 14 },
];

function shirtBody(d, c) {
  if (d.shirt) return d.shirt(c);
  return wordsHTML(c, d.words, d.n, 3800, 4600);
}
function mugSide(d, c) {
  if (d.mug) return d.mug(c);
  return wordsHTML(c, d.words, d.n, 1000, 960);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Chromium can't always reach Google Fonts directly, so fetch the faces with curl
// and point the pages at local copies.
const FONT_DIR = join(OUT, '.fonts');
mkdirSync(FONT_DIR, { recursive: true });
const curl = (url, out) => execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36', ...(out ? ['-o', out] : []), url], { encoding: out ? undefined : 'utf8' });
let fontCSS = curl(FONTS);
let k = 0;
fontCSS = fontCSS.replace(/url\((https:[^)]+)\)/g, (_, url) => {
  const file = join(FONT_DIR, `f${k++}.woff2`);
  curl(url, file);
  return `url(${pathToFileURL(file).href})`;
});
const FONT_CSS = join(FONT_DIR, 'fonts.css');
writeFileSync(FONT_CSS, fontCSS);
const browser = await chromium.launch();

async function render(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const tmp = join(FONT_DIR, 'page.html');
  writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  const ok = await page.evaluate(async () => {
    const faces = ['500 20px Lora', '600 20px Lora', 'italic 500 20px Lora', 'italic 400 20px Lora', '400 20px "DM Sans"', '500 20px "DM Sans"', '600 20px "DM Sans"'];
    await Promise.all(faces.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    // scale each block of words to fill its space, now the real widths are known
    for (const el of document.querySelectorAll('.words')) {
      const s = Math.min(el.dataset.w / el.offsetWidth, el.dataset.h / el.offsetHeight);
      el.style.setProperty('--s', s);
    }
    return faces.every((f) => document.fonts.check(f));
  });
  if (!ok) throw new Error('Fonts did not load');
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
}

const made = [];
for (const d of DESIGNS) for (const [ink, c] of Object.entries(INKS)) {
  const shirt = join(OUT, `${d.id}-shirt-${ink}.png`);
  await render(pageHTML(c, shirtBody(d, c), 4500, 5400), 4500, 5400, shirt);
  // a mug shows the design on both sides of the handle
  const mug = join(OUT, `${d.id}-mug-${ink}.png`);
  await render(pageHTML(c, `<div class="mug"><div>${mugSide(d, c)}</div><div>${mugSide(d, c)}</div></div>`, 2475, 1155), 2475, 1155, mug);
  made.push({ d, ink, shirt, mug });
}

// Mockups: each design on a natural shirt and a dark shirt, and on a white mug.
const tee = (fill) => `<svg viewBox="0 0 600 640" width="600" height="640" style="position:absolute;inset:0"><path d="M195 30 Q300 80 405 30 L560 95 L520 230 L470 210 L470 620 L130 620 L130 210 L80 230 L40 95 Z" fill="${fill}" stroke="rgba(0,0,0,.08)" stroke-width="2"/><path d="M195 30 Q300 95 405 30" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="3"/></svg>`;
const rel = (f) => pathToFileURL(f).href;
const cards = DESIGNS.map((d) => {
  const L = made.find((m) => m.d === d && m.ink === 'light'), D = made.find((m) => m.d === d && m.ink === 'dark');
  return `<section><h2>${d.words ? d.words.join(' ') : 'The M60 ring map'}</h2><div class="row">
    <div class="shirt">${tee('#efe7d6')}<img src="${rel(L.shirt)}" class="print"></div>
    <div class="shirt">${tee('#22303a')}<img src="${rel(D.shirt)}" class="print"></div>
    <div class="mugbox"><div class="mugbody"><img src="${rel(L.mug)}"></div><div class="handle"></div></div>
  </div></section>`;
}).join('');
const mock = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(FONT_CSS).href}"><style>
  body { margin: 0; padding: 48px 56px; background: #f5f1e8; font-family: 'DM Sans'; color: #2f3b35; width: 1880px; }
  h1 { font: 500 44px Lora; margin: 0 0 8px; } p { margin: 0 0 28px; color: #6c776f; }
  h2 { font: 500 26px Lora; margin: 28px 0 14px; }
  .row { display: flex; gap: 36px; align-items: center; }
  .shirt { position: relative; width: 600px; height: 640px; }
  .print { position: absolute; left: 175px; top: 140px; width: 250px; }
  .mugbox { position: relative; width: 470px; height: 380px; display: flex; align-items: center; }
  .mugbody { width: 380px; height: 380px; border-radius: 10px 10px 26px 26px; background: #fff; box-shadow: inset -30px 0 40px rgba(0,0,0,.06), 0 8px 24px rgba(47,40,30,.1); overflow: hidden; position: relative; }
  .mugbody img { position: absolute; width: 760px; top: 12px; left: 0; } /* one side of the wrap */
  .handle { width: 90px; height: 200px; border: 26px solid #fff; border-left: 0; border-radius: 0 100px 100px 0; box-shadow: 4px 6px 16px rgba(47,40,30,.1); }
</style></head><body><h1>m60motorway.com merch</h1><p>Natural and dark shirts use the light and dark ink files; mugs use the light ink. Mockups are approximate.</p>${cards}</body></html>`;
writeFileSync(join(OUT, 'mockups.html'), mock);
const page = await browser.newPage({ viewport: { width: 1992, height: 800 } });
await page.goto(rel(join(OUT, 'mockups.html')), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(OUT, 'mockups.png'), fullPage: true });
await browser.close();
rmSync(join(OUT, 'mockups.html'));
rmSync(FONT_DIR, { recursive: true, force: true });
console.log(`Made ${made.length * 2} print files and mockups.png in merch/`);
