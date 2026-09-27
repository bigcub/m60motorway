// Builds the HTML for the junction list and "Good to know". The page (script.js)
// and the static build (scripts/build_site.mjs) both use it, so every page ships
// with its words already written in for search engines, and the browser keeps
// them up to date as you use the map.
(function (root) {
  'use strict';

  const N = 27;
  const TOTAL = 36.1;
  const MOTORWAY_JUNCTIONS = new Set([4, 12, 15, 18, 24]);

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const wrapN = (n) => ((n - 1 + N) % N) + 1;
  const nextOf = (n, dir) => (dir === 'cw' ? wrapN(n + 1) : wrapN(n - 1));
  const other = (dir) => (dir === 'cw' ? 'acw' : 'cw');
  const dirWord = (d) => (d === 'cw' ? 'clockwise' : 'anticlockwise');
  const junctionPath = (n) => `junction-${n}/`;
  const roadsOf = (j) => {
    const s = new Set();
    [...(j.cw || []), ...(j.acw || [])].forEach((r) => r[0].split(' ').forEach((t) => s.add(t.replace(/^\((.*)\)$/, '$1'))));
    return [...s].filter((t) => t !== 'M6');
  };
  const milesBetween = (J, from, to, dir) => {
    const a = J[from - 1].mi, b = J[to - 1].mi;
    return dir === 'cw' ? (b - a + TOTAL) % TOTAL : (a - b + TOTAL) % TOTAL;
  };

  const icon = {
    cw: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.2 10A6.2 6.2 0 1 1 13.4 4.8"/><path d="M13.8 1.8v3.4h-3.4"/></svg>',
    acw: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.8 10A6.2 6.2 0 1 0 6.6 4.8"/><path d="M6.2 1.8v3.4h3.4"/></svg>',
  };
  const chipsHTML = (road) => road.split(' ').map((t) => `<span class="chip${/^\(?M\d|\(M\)/.test(t) ? ' m' : ''}">${esc(t)}</span>`).join('');

  // an opened junction: where the signs send you, how far to the next one, and a note
  function detailHTML(J, j, dir) {
    const rows = j[dir], nx = nextOf(j.n, dir), w = dirWord(dir);
    const signs = rows
      ? `<p class="eyebrow">Leaving ${w}, signed for</p>` +
        rows.map((r) => `<div class="sign-row"><span class="chips">${chipsHTML(r[0])}</span><span class="places">${esc(r[1])}</span></div>`).join('')
      : `<p class="no-exit">No exit ${w}.<span>Only a slip road joins here. Stay on for J${nx}, or use this junction travelling ${dirWord(other(dir))}.</span></p>`;
    const exit = (ok, d) => `<span class="${ok ? '' : 'no'}" title="${ok ? 'Exit' : 'No exit'} ${dirWord(d)}">${icon[d]}${d === 'cw' ? 'Clockwise' : 'Anti'}</span>`;
    return `
      <div class="jbody">
        <div class="signs">${signs}</div>
        <dl class="facts">
          <div><dt>Mile</dt><dd>${j.mi.toFixed(1)} <small>of 36.1</small></dd></div>
          <div><dt>Next ${dir === 'cw' ? '↻' : '↺'}</dt><dd>J${nx} <small>in ${milesBetween(J, j.n, nx, dir).toFixed(1)} mi</small></dd></div>
          <div><dt>Exits</dt><dd class="exits">${exit(!!j.cw, 'cw')}${exit(!!j.acw, 'acw')}</dd></div>
        </dl>
        <p class="note">${esc(j.note)}</p>
      </div>`;
  }

  // The panel is the ring itself: every junction in order, grouped by stretch, with the chosen one open.
  // Each row is a real link to that junction's page, so search engines can follow it.
  function listHTML(J, stretches, sel, dir, rootPath) {
    return stretches.map((st) => `
      <section class="stretch">
        <h2 class="stretch-head"><span>${esc(st.name)}</span><span>${st.a}–${st.b}</span></h2>
        ${J.slice(st.a - 1, st.b).map((j) => {
          const open = j.n === sel;
          return `
          <article class="jitem${open ? ' open' : ''}" data-n="${j.n}">
            <a class="jrow" href="${rootPath}${junctionPath(j.n)}" aria-expanded="${open}" aria-label="Junction ${j.n}, ${esc(j.loc)}">
              <span class="num${MOTORWAY_JUNCTIONS.has(j.n) ? ' mw' : ''}">${j.n}</span>
              <span class="where"><span class="place">${esc(j.loc)}</span>${open && j.name ? `<span class="aka">${esc(j.name)}</span>` : ''}</span>
              <span class="roads">${roadsOf(j).join(' · ')}</span>
            </a>
            ${open ? detailHTML(J, j, dir) : ''}
          </article>`;
        }).join('')}
      </section>`).join('');
  }

  // "Good to know" under About; each junction number links to that junction
  function quirksHTML(quirks, rootPath) {
    return quirks.map((q) => `
      <li>
        <p class="q-title">${esc(q.title)}</p>
        <p class="q-text">${esc(q.text)}</p>
        <p class="q-links">${q.js.map((n) => `<a class="jlink" href="${rootPath}${junctionPath(n)}" data-n="${n}" aria-label="Junction ${n}">J${n}</a>`).join('')}</p>
      </li>`).join('');
  }

  // the text of one direction's signs, for page descriptions
  const signsText = (rows) => (rows ? rows.map((r) => `${r[0].replace(/[()]/g, '')} ${r[1]}`).join('; ') : 'no exit');

  root.M60 = { N, TOTAL, MOTORWAY_JUNCTIONS, esc, wrapN, nextOf, other, dirWord, junctionPath, roadsOf, milesBetween, detailHTML, listHTML, quirksHTML, signsText };
})(typeof window !== 'undefined' ? window : globalThis);
