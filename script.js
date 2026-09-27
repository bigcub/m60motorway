(() => {
  'use strict';

  const GEO = window.GEO;
  const N = 27;
  const TOTAL = 36.1;
  const MOTORWAY_JUNCTIONS = new Set([4, 12, 15, 18, 24]);
  const SPUR_TO = { M56: 'to the Airport', M602: 'to Salford', M61: 'to Bolton', M66: 'to Bury', M67: 'to Sheffield' };
  const LANDMARKS = ['Trafford Centre', 'Old Trafford', 'Etihad Stadium', 'Stockport Pyramid', 'Heaton Park'];

  /* ---------- helpers ---------- */
  const $ = (s) => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const wrapN = (n) => ((n - 1 + N) % N) + 1;
  const nextOf = (n, dir) => (dir === 'cw' ? wrapN(n + 1) : wrapN(n - 1));
  const other = (dir) => (dir === 'cw' ? 'acw' : 'cw');
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roadsOf = (j) => {
    const s = new Set();
    [...(j.cw || []), ...(j.acw || [])].forEach((r) => r[0].split(' ').forEach((t) => s.add(t.replace(/^\((.*)\)$/, '$1'))));
    return [...s].filter((t) => t !== 'M6');
  };

  /* ---------- state ---------- */
  const prefs = store.get('m60.prefs', {});
  const S = { sel: 1, dir: prefs.dir === 'acw' ? 'acw' : 'cw', nums: prefs.nums !== false, spot: null, driving: false };
  const savePrefs = () => store.set('m60.prefs', { dir: S.dir, nums: S.nums });

  /* ---------- geometry ---------- */
  const VB0 = { x: GEO.vb[0], y: GEO.vb[1], w: GEO.vb[2], h: GEO.vb[3] };
  const CTR = { x: GEO.ctr[0], y: GEO.ctr[1] };
  const CL = GEO.cl.map((p) => ({ x: p[0], y: p[1] }));
  const CUM = [0];
  for (let i = 0; i < CL.length; i++) {
    const a = CL[i], b = CL[(i + 1) % CL.length];
    CUM.push(CUM[i] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const LEN = CUM[CL.length];
  const J = GEO.J.map((g, i) => ({ ...g, ...window.JUNCTIONS[i], s: CUM[g.seg] + Math.hypot(g.x - CL[g.seg].x, g.y - CL[g.seg].y) }));

  function pointAt(s) {
    s = ((s % LEN) + LEN) % LEN;
    let lo = 0, hi = CL.length;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CUM[m] <= s) lo = m; else hi = m; }
    const a = CL[lo], b = CL[(lo + 1) % CL.length], t = (s - CUM[lo]) / (CUM[lo + 1] - CUM[lo] || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  // points along the centreline, clockwise from s0 to s1
  function arcPts(s0, s1) {
    if (s1 < s0) s1 += LEN;
    const pts = [pointAt(s0)];
    for (let i = 0; i <= CL.length * 2; i++) {
      const c = CUM[i % CL.length] + (i >= CL.length ? LEN : 0);
      if (c > s0 && c < s1) pts.push(CL[i % CL.length]);
    }
    pts.push(pointAt(s1));
    return pts;
  }
  const ptsD = (pts) => 'M' + pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('L');
  const milesBetween = (from, to, dir) => {
    const a = J[from - 1].mi, b = J[to - 1].mi;
    return dir === 'cw' ? (b - a + TOTAL) % TOTAL : (a - b + TOTAL) % TOTAL;
  };

  /* ---------- build the map ---------- */
  const svg = $('#map');
  let view = { ...VB0 };

  const defs = el('defs', {}, svg);
  const fade = el('radialGradient', { id: 'spurFade', gradientUnits: 'userSpaceOnUse', cx: CTR.x, cy: CTR.y, r: GEO.clip }, defs);
  el('stop', { offset: 0, 'stop-color': '#fff' }, fade);
  el('stop', { offset: 0.78, 'stop-color': '#fff' }, fade);
  el('stop', { offset: 1, 'stop-color': '#000' }, fade);
  const big = { x: VB0.x - 600, y: VB0.y - 600, width: VB0.w + 1200, height: VB0.h + 1200 };
  const mask = el('mask', { id: 'spurMask', maskUnits: 'userSpaceOnUse', ...big }, defs);
  el('rect', { ...big, fill: 'url(#spurFade)' }, mask);

  const gWater = el('g', {}, svg);
  for (const [name, d] of Object.entries(GEO.rivers)) {
    const p = el('path', { d, class: 'water' + (name.includes('Canal') ? ' canal' : '') }, gWater);
    el('title', {}, p).textContent = name;
  }
  const gSpur = el('g', { mask: 'url(#spurMask)' }, svg);
  for (const d of Object.values(GEO.spurs)) el('path', { d, class: 'spur' }, gSpur);
  const gLabels = el('g', {}, svg);
  el('path', { d: GEO.ring, class: 'ring-halo' }, svg);
  el('path', { d: GEO.ring, class: 'ring' }, svg);
  const companion = el('path', { class: 'companion' }, svg);
  const arc = el('path', { class: 'arc' }, svg);
  const gChev = el('g', {}, svg);
  const chevrons = Array.from({ length: 12 }, () => {
    const g = el('g', {}, gChev);
    el('path', { class: 'chev', d: 'M-2,-3L2,0L-2,3' }, g);
    return g;
  });
  const gLead = el('g', {}, svg);
  const gAnchor = el('g', {}, svg);
  const gTags = el('g', {}, svg);
  const gTokens = el('g', {}, svg);
  const car = el('g', { class: 'car' }, svg);
  car.style.display = 'none';
  el('circle', { class: 'halo', r: 13 }, car);
  el('circle', { class: 'dot', r: 6 }, car);

  // rivers, towns and landmarks, drawn at a constant size on screen
  const labels = [];
  for (const [name, x, y, angle] of GEO.riverLabels) {
    const g = el('g', { class: 'water-label' }, gLabels);
    el('text', { x: 0, y: 3.5, 'text-anchor': 'middle' }, g).textContent = name;
    labels.push({ g, x, y, angle, w: name.length * 5.4, h: 14, ox: 0, oy: 0, kind: 'water' });
  }
  for (const [name, [x, y]] of Object.entries(GEO.places)) {
    const kind = name === 'Manchester' ? 'city' : LANDMARKS.includes(name) ? 'landmark' : 'town';
    const g = el('g', { class: 'place ' + kind }, gLabels);
    let w, h = 14, ox = 0, oy = 0;
    if (kind === 'city') {
      el('circle', { class: 'ring-mark', r: 6.5 }, g);
      el('circle', { r: 2.6 }, g);
      el('text', { x: 0, y: -13, 'text-anchor': 'middle' }, g).textContent = 'Manchester';
      w = 92; h = 20; oy = -17;
    } else if (kind === 'landmark') {
      el('circle', { r: 2.2 }, g);
      el('text', { x: 6, y: 3.8 }, g).textContent = name;
      w = name.length * 5.5 + 8; ox = w / 2 - 2;
    } else {
      el('text', { x: 0, y: 3.5, 'text-anchor': 'middle' }, g).textContent = name;
      w = name.length * 7.6;
    }
    labels.push({ g, x, y, angle: 0, w, h, ox, oy, kind });
  }

  // tags where the other motorways leave the map
  function roadTag(ref, to, parent, extra) {
    const g = el('g', { class: 'road-tag' + (extra ? ' ' + extra : '') }, parent);
    const w = ref.length * 7.2 + 14;
    el('rect', { x: -w / 2, y: -9, width: w, height: 18, rx: 9 }, g);
    el('text', { class: 'ref', x: 0, y: 3.8, 'text-anchor': 'middle' }, g).textContent = ref;
    if (to) el('text', { class: 'to', x: 0, y: 23, 'text-anchor': 'middle' }, g).textContent = to;
    return g;
  }
  const tags = GEO.spurLabels.map(([ref, x, y]) => {
    if (ref === 'M602') { x += (J[11].x - x) * 0.5; y += (J[11].y - y) * 0.5; } // halfway along, clear of the city centre
    const to = ref === 'M62' ? (x < CTR.x ? 'to Liverpool' : 'to Leeds') : SPUR_TO[ref];
    return { g: roadTag(ref, to, gTags), x, y };
  });
  const companionTag = roadTag('M62', '', gTags, 'companion-tag');

  // junction tokens
  J.forEach((j) => {
    j.lead = el('line', { class: 'leader' }, gLead);
    j.dot = el('circle', { class: 'anchor' }, gAnchor);
    const g = el('g', { class: 'token' + (MOTORWAY_JUNCTIONS.has(j.n) ? ' mw' : '') }, gTokens);
    el('circle', { class: 'glow', r: 16 }, g);
    el('circle', { class: 'face', r: 10.5 }, g);
    j.txt = el('text', { x: 0, y: 0.5 }, g);
    j.g = g;
    g.addEventListener('click', () => { if (!dragMoved) { stopDrive(); select(j.n); } });
    g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(j); });
    g.addEventListener('pointerleave', hideTip);
  });

  /* ---------- layout of the screen-sized symbols ---------- */
  let K = 1;
  function unitsPerPx() {
    const r = svg.getBoundingClientRect();
    return Math.max(view.w / (r.width || 1), view.h / (r.height || 1));
  }
  const place = (g, x, y, k, extra = '') => g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})${extra} scale(${k})`);

  function layout() {
    const k = (K = unitsPerPx());
    svg.style.setProperty('--k', k);

    // Tokens sit just outside the ring, then push apart until none overlap each other or the road.
    const R = 11 * k, sep = 2 * R + 3 * k, clear = R + 6 * k;
    const ringPts = CL.filter((_, i) => i % 2 === 0);
    const P = J.map((j) => {
      const dx = j.x - CTR.x, dy = j.y - CTR.y, d = Math.hypot(dx, dy) || 1, off = R + 12 * k;
      const tx = j.x + (dx / d) * off, ty = j.y + (dy / d) * off;
      return { x: tx, y: ty, tx, ty };
    });
    for (let it = 0; it < 140; it++) {
      for (const p of P) { p.x += (p.tx - p.x) * 0.06; p.y += (p.ty - p.y) * 0.06; }
      for (let a = 0; a < P.length; a++) {
        for (let b = a + 1; b < P.length; b++) {
          const A = P[a], B = P[b];
          let dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
          if (d < sep) {
            if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
            const m = (sep - d) / 2;
            A.x -= (dx / d) * m; A.y -= (dy / d) * m; B.x += (dx / d) * m; B.y += (dy / d) * m;
          }
        }
      }
      for (const p of P) {
        for (const q of ringPts) {
          const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
          if (d < clear && d > 1e-6) { const m = (clear - d) * 0.5; p.x += (dx / d) * m; p.y += (dy / d) * m; }
        }
      }
    }
    J.forEach((j, i) => {
      j.bx = P[i].x; j.by = P[i].y;
      place(j.g, j.bx, j.by, k);
      j.dot.setAttribute('cx', j.x); j.dot.setAttribute('cy', j.y); j.dot.setAttribute('r', 3.2 * k);
      j.lead.setAttribute('x1', j.x); j.lead.setAttribute('y1', j.y); j.lead.setAttribute('x2', j.bx); j.lead.setAttribute('y2', j.by);
    });

    // road tags, kept inside the view
    for (const t of tags) {
      const pad = 34 * k;
      t.px = Math.min(Math.max(t.x, view.x + pad), view.x + view.w - pad);
      t.py = Math.min(Math.max(t.y, view.y + pad * 0.6), view.y + view.h - pad * 1.4);
      place(t.g, t.px, t.py, k);
      // on a small map a tag can land on the tokens; leave it out rather than cover a number
      t.g.style.display = J.some((j) => Math.abs(j.bx - t.px) < 32 * k && Math.abs(j.by - (t.py + 7 * k)) < 26 * k) ? 'none' : '';
    }

    // labels: hide any that would sit on a token, a tag or the road
    for (const l of labels) {
      place(l.g, l.x, l.y, k, l.angle ? ` rotate(${l.angle})` : '');
      const cx = l.x + l.ox * k, cy = l.y + l.oy * k;
      const hw = (l.w * k) / 2 + 3 * k, hh = (l.h * k) / 2 + 2 * k;
      const rw = l.angle ? Math.max(hw * Math.abs(Math.cos((l.angle * Math.PI) / 180)), hh) : hw;
      const rh = l.angle ? Math.max(hw * Math.abs(Math.sin((l.angle * Math.PI) / 180)), hh) : hh;
      let hit = l.kind !== 'city' && J.some((j) => Math.abs(j.bx - cx) < rw + 12 * k && Math.abs(j.by - cy) < rh + 12 * k);
      if (!hit && l.kind !== 'city') hit = tags.some((t) => t.g.style.display !== 'none' && Math.abs(t.px - cx) < rw + 24 * k && Math.abs(t.py - cy) < rh + 22 * k);
      if (!hit && l.kind !== 'city') hit = CL.some((q) => Math.abs(q.x - cx) < rw + 8 * k && Math.abs(q.y - cy) < rh + 8 * k);
      l.g.style.display = hit ? 'none' : '';
    }

    // direction chevrons on the road
    chevrons.forEach((g, i) => {
      const s = ((i + 0.5) / chevrons.length) * LEN;
      const a = pointAt(s - 3), b = pointAt(s + 3), p = pointAt(s);
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + (S.dir === 'acw' ? 180 : 0);
      place(g, p.x, p.y, k, ` rotate(${ang.toFixed(1)})`);
    });

    // the M62's shared stretch, as a dotted line just inside the ring
    const s12 = J[11].s, s18 = J[17].s;
    const inset = (p, by) => { const dx = p.x - CTR.x, dy = p.y - CTR.y, d = Math.hypot(dx, dy), f = 1 - by / d; return { x: CTR.x + dx * f, y: CTR.y + dy * f }; };
    companion.setAttribute('d', ptsD(arcPts(s12, s18).map((p) => inset(p, 13 * k))));
    const mid = inset(pointAt(s12 + ((s18 - s12 + LEN) % LEN) * 0.6), 34 * k);
    place(companionTag, mid.x, mid.y, k);

    updateScale(k);
    placeCar();
  }
  let layoutQueued = false;
  const queueLayout = () => {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; layout(); });
  };

  // scale bar: pick a round distance that draws at a comfortable length
  function updateScale(k) {
    const pxPerMile = GEO.unitsPerMile / k;
    const steps = [0.25, 0.5, 1, 2, 5];
    const miles = steps.find((m) => m * pxPerMile >= 56) || 5;
    $('#scale-bar').style.width = Math.round(miles * pxPerMile) + 'px';
    $('#scale-label').textContent = miles === 1 ? '1 mile' : (miles < 1 ? (miles === 0.5 ? '½' : '¼') + ' mile' : miles + ' miles');
  }

  /* ---------- rendering ---------- */
  const icon = {
    left: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 5 7 10l5 5"/></svg>',
    right: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg>',
    cw: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.2 10A6.2 6.2 0 1 1 13.4 4.8"/><path d="M13.8 1.8v3.4h-3.4"/></svg>',
    acw: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.8 10A6.2 6.2 0 1 0 6.6 4.8"/><path d="M6.2 1.8v3.4h3.4"/></svg>',
  };
  const chipsHTML = (road) => road.split(' ').map((t) => `<span class="chip${/^\(?M\d|\(M\)/.test(t) ? ' m' : ''}">${esc(t)}</span>`).join('');

  function renderDetail() {
    const j = J[S.sel - 1], rows = j[S.dir];
    const nx = nextOf(j.n, S.dir), pv = nextOf(j.n, other(S.dir));
    const dirWord = S.dir === 'cw' ? 'clockwise' : 'anticlockwise';
    const signs = rows
      ? `<p class="eyebrow">Leaving ${dirWord}, signed for</p>` +
        rows.map((r) => `<div class="sign-row"><span class="chips">${chipsHTML(r[0])}</span><span class="places">${esc(r[1])}</span></div>`).join('')
      : `<p class="no-exit">No exit ${dirWord}.<span>Only a slip road joins here. Stay on for J${nx}, or use this junction when travelling ${S.dir === 'cw' ? 'anticlockwise' : 'clockwise'}.</span></p>`;
    const exit = (ok, dir) => `<span class="${ok ? '' : 'no'}" title="${ok ? 'Exit' : 'No exit'} ${dir === 'cw' ? 'clockwise' : 'anticlockwise'}">${icon[dir]}${dir === 'cw' ? 'Clockwise' : 'Anti'}</span>`;
    $('#detail').innerHTML = `
      <div class="jhead">
        <div class="jnum-big" aria-label="Junction ${j.n}">${j.n}</div>
        <div><h2>${esc(j.loc)}</h2>${j.name ? `<p class="aka">${esc(j.name)}</p>` : ''}</div>
      </div>
      <div class="signs">${signs}</div>
      <dl class="facts">
        <div><dt>Mile</dt><dd>${j.mi.toFixed(1)} <small>of 36.1</small></dd></div>
        <div><dt>Next ${dirWord === 'clockwise' ? '↻' : '↺'}</dt><dd>J${nx} <small>in ${milesBetween(j.n, nx, S.dir).toFixed(1)} mi</small></dd></div>
        <div><dt>Exits</dt><dd class="exits">${exit(!!j.cw, 'cw')}${exit(!!j.acw, 'acw')}</dd></div>
      </dl>
      <p class="hook">${esc(j.hook)}</p>
      <div class="step">
        <button type="button" id="prev" aria-label="Previous junction, ${pv}">${icon.left}<span class="n">J${pv}</span></button>
        <button type="button" id="next" aria-label="Next junction, ${nx}"><span class="n">J${nx}</span>${icon.right}</button>
      </div>`;
    $('#prev').onclick = () => { stopDrive(); select(pv, true); };
    $('#next').onclick = () => { stopDrive(); select(nx, true); };
  }

  function renderList() {
    $('#list').innerHTML = window.STRETCHES.map((st) => `
      <div class="stretch">
        <p class="stretch-head eyebrow"><span>${esc(st.side)} · ${st.a}–${st.b}</span><span>${esc(st.name)}</span></p>
        ${J.slice(st.a - 1, st.b).map((j) => `
          <button type="button" class="jrow" data-n="${j.n}" aria-current="${j.n === S.sel}">
            <span class="num${MOTORWAY_JUNCTIONS.has(j.n) ? ' mw' : ''}">${j.n}</span>
            <span class="where">${esc(j.loc)}</span>
            <span class="roads">${roadsOf(j).join(' · ')}</span>
          </button>`).join('')}
      </div>`).join('');
    document.querySelectorAll('.jrow').forEach((b) => {
      b.onclick = () => { stopDrive(); select(+b.dataset.n, true); revealMap(); };
    });
  }

  function renderHooks() {
    $('#hooks').innerHTML = window.HOOKS.map((h, i) => `
      <button type="button" class="hook-card tone-${h.tone}" data-i="${i}" aria-pressed="false">
        <span class="fig">${esc(h.figure)}</span>
        <span class="t">${esc(h.title)}</span>
        <span class="x">${esc(h.text)}</span>
      </button>`).join('');
    document.querySelectorAll('.hook-card').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.i;
        S.spot = S.spot === i ? null : i;
        document.querySelectorAll('.hook-card').forEach((c) => c.setAttribute('aria-pressed', String(+c.dataset.i === S.spot)));
        renderMap();
        if (S.spot !== null) revealMap();
      };
    });
  }

  function renderMap() {
    const spot = S.spot === null ? null : new Set(window.HOOKS[S.spot].js);
    J.forEach((j) => {
      const on = j.n === S.sel;
      j.g.classList.toggle('sel', on);
      j.g.classList.toggle('spot', !!spot && spot.has(j.n));
      j.txt.textContent = S.nums || on || (spot && spot.has(j.n)) ? j.n : '';
      j.dot.classList.toggle('on', on);
    });
    const nx = nextOf(S.sel, S.dir);
    arc.setAttribute('d', ptsD(S.dir === 'cw' ? arcPts(J[S.sel - 1].s, J[nx - 1].s) : arcPts(J[nx - 1].s, J[S.sel - 1].s)));
  }

  function render() {
    renderMap();
    renderDetail();
    document.querySelectorAll('.jrow').forEach((b) => b.setAttribute('aria-current', String(+b.dataset.n === S.sel)));
    $('#d-cw').setAttribute('aria-pressed', String(S.dir === 'cw'));
    $('#d-acw').setAttribute('aria-pressed', String(S.dir === 'acw'));
    $('#nums').setAttribute('aria-pressed', String(S.nums));
    queueLayout();
  }

  /* ---------- interactions ---------- */
  function select(n, reveal) {
    S.sel = n;
    try { history.replaceState(null, '', '#j' + n); } catch (e) { /* not allowed here */ }
    render();
    if (reveal) ensureVisible(J[n - 1]);
  }
  function setDir(d) { S.dir = d; savePrefs(); render(); }
  function setNums(v) { S.nums = v; savePrefs(); render(); }
  // on narrow screens the map scrolls away; bring it back when the list or a hook changes it
  function revealMap() {
    const r = $('#mapwrap').getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) $('#mapwrap').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
  }

  $('#d-cw').onclick = () => setDir('cw');
  $('#d-acw').onclick = () => setDir('acw');
  $('#nums').onclick = () => setNums(!S.nums);
  $('#theme').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stopDrive(); select(nextOf(S.sel, S.dir), true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stopDrive(); select(nextOf(S.sel, other(S.dir)), true); }
    else if (e.key === 'n' || e.key === 'N') setNums(!S.nums);
    else if (e.key === 'd' || e.key === 'D') setDir(other(S.dir));
  });

  /* tooltip */
  const tip = $('#tip');
  function showTip(j) {
    const wrap = $('#mapwrap').getBoundingClientRect(), r = svg.getBoundingClientRect(), k = unitsPerPx();
    const offX = (r.width - view.w / k) / 2, offY = (r.height - view.h / k) / 2;
    const known = S.nums || j.n === S.sel;
    tip.innerHTML = `<b>${known ? 'J' + j.n : 'Junction'}</b> ${esc(j.loc)} <span>· ${roadsOf(j).join(', ')}</span>`;
    tip.style.left = r.left - wrap.left + offX + (j.bx - view.x) / k + 'px';
    tip.style.top = r.top - wrap.top + offY + (j.by - view.y) / k + 'px';
    tip.hidden = false;
  }
  function hideTip() { tip.hidden = true; }

  /* ---------- pan and zoom ---------- */
  const MIN_W = VB0.w / 7;
  const full = () => view.w >= VB0.w * 0.999;
  function clampView() {
    if (full()) { view = { ...VB0 }; return; }
    if (view.w < MIN_W) {
      const f = MIN_W / view.w, cx = view.x + view.w / 2, cy = view.y + view.h / 2;
      view.w *= f; view.h *= f; view.x = cx - view.w / 2; view.y = cy - view.h / 2;
    }
    const cx = Math.min(Math.max(view.x + view.w / 2, VB0.x), VB0.x + VB0.w);
    const cy = Math.min(Math.max(view.y + view.h / 2, VB0.y), VB0.y + VB0.h);
    view.x = cx - view.w / 2; view.y = cy - view.h / 2;
  }
  function applyView() {
    clampView();
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.style.touchAction = full() ? 'pan-y' : 'none';
    hideTip();
    queueLayout();
  }
  function toSvg(cx, cy) {
    const r = svg.getBoundingClientRect(), k = unitsPerPx();
    const offX = (r.width - view.w / k) / 2, offY = (r.height - view.h / k) / 2;
    return { x: view.x + (cx - r.left - offX) * k, y: view.y + (cy - r.top - offY) * k };
  }
  function zoomAt(p, f) {
    const nw = Math.min(Math.max(view.w * f, MIN_W), VB0.w);
    f = nw / view.w;
    view = { x: p.x - (p.x - view.x) * f, y: p.y - (p.y - view.y) * f, w: view.w * f, h: view.h * f };
    applyView();
  }
  function animateTo(target, ms = 420) {
    if (reduceMotion()) { view = target; applyView(); return; }
    const from = { ...view }, t0 = performance.now();
    const step = (t) => {
      const u = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - u, 3);
      view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      applyView();
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function zoomBy(f) {
    const c = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
    const nw = Math.min(Math.max(view.w * f, MIN_W), VB0.w), nh = (nw * VB0.h) / VB0.w;
    animateTo({ x: c.x - nw / 2, y: c.y - nh / 2, w: nw, h: nh });
  }
  function ensureVisible(j) {
    if (full()) return;
    const m = view.w * 0.12;
    if (j.x > view.x + m && j.x < view.x + view.w - m && j.y > view.y + m && j.y < view.y + view.h - m) return;
    animateTo({ x: j.x - view.w / 2, y: j.y - view.h / 2, w: view.w, h: view.h });
  }
  $('#zin').onclick = () => zoomBy(0.6);
  $('#zout').onclick = () => zoomBy(1 / 0.6);
  $('#zfit').onclick = () => animateTo({ ...VB0 });

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    // a trackpad pinch arrives as ctrl+wheel with small deltas, so it gets a much higher rate than a mouse wheel
    const rate = e.deltaMode ? 0.05 : e.ctrlKey ? 0.022 : 0.004;
    zoomAt(toSvg(e.clientX, e.clientY), Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * rate));
  }, { passive: false });
  svg.addEventListener('dblclick', (e) => {
    if (e.target.closest('.token')) return;
    const p = toSvg(e.clientX, e.clientY), nw = Math.max(view.w * 0.55, MIN_W), f = nw / view.w;
    animateTo({ x: p.x - (p.x - view.x) * f, y: p.y - (p.y - view.y) * f, w: nw, h: view.h * f });
  });

  const pointers = new Map();
  let drag = null, pinch = null, dragMoved = false;
  svg.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { drag = { x: e.clientX, y: e.clientY, v: { ...view } }; dragMoved = false; }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), v: { ...view }, mid: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2) };
      drag = null; dragMoved = true;
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      view = { ...pinch.v };
      zoomAt(pinch.mid, pinch.d / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1));
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!dragMoved && Math.hypot(dx, dy) > 5) {
        if (full()) { drag = null; return; }
        dragMoved = true;
        svg.classList.add('dragging');
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      if (dragMoved) {
        const k = unitsPerPx();
        view = { ...drag.v, x: drag.v.x - dx * k, y: drag.v.y - dy * k };
        applyView();
      }
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) { drag = null; svg.classList.remove('dragging'); }
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('click', (e) => { if (dragMoved) e.stopPropagation(); }, true);
  new ResizeObserver(() => applyView()).observe(svg);

  /* ---------- drive the loop ---------- */
  let carS = 0, lastT = 0, raf = 0;
  function placeCar() {
    if (!S.driving) { car.style.display = 'none'; return; }
    const p = pointAt(carS);
    car.style.display = '';
    place(car, p.x, p.y, K);
  }
  function startDrive() {
    S.driving = true; carS = J[S.sel - 1].s; lastT = 0;
    $('#drive').setAttribute('aria-pressed', 'true');
    $('#drive-label').textContent = 'Stop';
    raf = requestAnimationFrame(tick);
  }
  function stopDrive() {
    if (!S.driving) return;
    S.driving = false;
    cancelAnimationFrame(raf);
    $('#drive').setAttribute('aria-pressed', 'false');
    $('#drive-label').textContent = 'Drive the loop';
    placeCar();
  }
  function tick(t) {
    if (!S.driving) return;
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
    lastT = t;
    const sign = S.dir === 'cw' ? 1 : -1, speed = LEN / 48; // one lap in about 48 seconds
    const prev = carS;
    carS += sign * speed * dt;
    for (const j of J) { // select each junction as the car passes it
      const a = (((prev - j.s) % LEN) + LEN) % LEN, b = (((carS - j.s) % LEN) + LEN) % LEN;
      const crossed = sign > 0 ? a > LEN / 2 && b < LEN / 2 && b < speed : a < LEN / 2 && b > LEN / 2 && a < speed;
      if (crossed && j.n !== S.sel) select(j.n);
    }
    placeCar();
    raf = requestAnimationFrame(tick);
  }
  $('#drive').onclick = () => (S.driving ? stopDrive() : startDrive());

  /* ---------- footer scene ---------- */
  const scene = document.querySelector('.scene svg');
  const syncScene = () => { if (scene && scene.pauseAnimations) reduceMotion() ? scene.pauseAnimations() : scene.unpauseAnimations(); };
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncScene);
  syncScene();

  /* ---------- start ---------- */
  const hash = /^#j(\d{1,2})$/.exec(location.hash);
  if (hash && +hash[1] >= 1 && +hash[1] <= N) S.sel = +hash[1];
  renderHooks();
  renderList();
  applyView();
  render();
})();
