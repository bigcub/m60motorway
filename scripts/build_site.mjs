// Builds the site into site/: the home page, a page for each junction, and the
// sitemap. Each page is src/page.html with its title, description and junction
// list written in, so search engines can read it without running the map.
//
//   node scripts/build_site.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site');
const ORIGIN = 'https://m60motorway.com/';

// the data and render files assign to window, so run them in a small sandbox
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ['data/geo.js', 'data/junctions.js', 'src/render.js']) vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), sandbox);
const { GEO, JUNCTIONS, STRETCHES, QUIRKS, M60 } = sandbox.window;
const J = GEO.J.map((g, i) => ({ ...g, ...JUNCTIONS[i] }));

const template = readFileSync(join(ROOT, 'src/page.html'), 'utf8');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function page(v) {
  const values = {
    ROBOTS: '',
    JUNCTION: '',
    ...v,
    TITLE: M60.esc(v.TITLE),
    DESCRIPTION: M60.esc(v.DESCRIPTION),
    LIST: M60.listHTML(J, STRETCHES, v.JUNCTION || 1, 'cw', v.ROOT),
    QUIRKS: M60.quirksHTML(QUIRKS, v.ROOT),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in values)) throw new Error(`No value for {{${k}}}`);
    return values[k];
  });
}

function write(rel, text) {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const homeDescription = "An interactive map of the M60, Manchester's orbital motorway: all 27 junctions from J1 at Stockport round to J27, where each exit is signed in both directions, and the distances between them.";
const home = {
  TITLE: 'M60 Motorway Map: All 27 Junctions and Where They Go',
  DESCRIPTION: homeDescription,
  URL: ORIGIN,
  H1_MORE: ': a map of all 27 junctions',
  JSONLD: json({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'M60 Motorway', url: ORIGIN, description: homeDescription }),
};
write('index.html', page({ ...home, ROOT: '' }));
// GitHub Pages serves 404.html for unknown paths, so it links from the site root
write('404.html', page({ ...home, ROOT: '/', ROBOTS: '<meta name="robots" content="noindex" />\n    ' }));

for (const j of J) {
  const url = ORIGIN + M60.junctionPath(j.n);
  const roads = M60.roadsOf(j).join(', ');
  const side = (d) => (j[d] ? `${d === 'cw' ? 'Clockwise' : 'Anticlockwise'}, signed for ${M60.signsText(j[d])}.` : `No ${M60.dirWord(d)} exit.`);
  write(M60.junctionPath(j.n) + 'index.html', page({
    ROOT: '../',
    JUNCTION: String(j.n),
    // the islands are better known by name than by town
    TITLE: `M60 Junction ${j.n}: ${/Island/.test(j.name || '') ? j.name : M60.placeOf(j)} (${roads})`,
    DESCRIPTION: `M60 junction ${j.n}${j.name ? `, ${j.name},` : ''} at ${j.byDestination ? j.town : M60.placeOf(j) + (j.town && j.town !== M60.placeOf(j) ? `, ${j.town}` : '')}. ${side('cw')} ${side('acw')} Mile ${j.mi.toFixed(1)} of 36.1 from J1.`,
    URL: url,
    H1_MORE: `: junction ${j.n}, ${j.loc}`,
    JSONLD: json({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'M60 Motorway', item: ORIGIN },
        { '@type': 'ListItem', position: 2, name: `Junction ${j.n}`, item: url },
      ],
    }),
  }));
}

const ASSETS = ['styles.css', 'script.js', 'render.js', 'og.png', 'CNAME', 'favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'site.webmanifest'];
for (const f of ASSETS) {
  if (existsSync(join(ROOT, 'src', f))) copyFileSync(join(ROOT, 'src', f), join(OUT, f));
}
mkdirSync(join(OUT, 'data'));
for (const f of ['geo.js', 'junctions.js']) copyFileSync(join(ROOT, 'data', f), join(OUT, 'data', f));

const today = new Date().toISOString().slice(0, 10);
const urls = [ORIGIN, ...J.map((j) => ORIGIN + M60.junctionPath(j.n))];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}sitemap.xml\n`);

console.log(`Built site/: home, 404 and ${J.length} junction pages`);
