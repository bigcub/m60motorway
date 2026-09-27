# m60motorway.com

A map of the M60, Manchester's orbital motorway. All 27 junctions are numbered
on a full-window map drawn from OpenStreetMap. A floating panel lists the ring
stretch by stretch. Open a junction to see where its exit signs send you in each
direction and how far it is to the next one. About has a "Good to know" section
on the road's quirks, such as half junctions and the M62 overlap, and its history.

Every junction also has its own page (`/junction-18/` and so on) with its own
title and description, and the words are written into the HTML so search engines
can read them without running the map.

## Local preview

```sh
node scripts/build_site.mjs
python3 -m http.server 8765 --directory site
```

Then open <http://localhost:8765>. Rebuild after editing anything in `src/` or `data/`.

## Layout

| Path | What it is |
| --- | --- |
| `src/page.html` | The page template. The build fills in each page's title, description and junction list. |
| `src/styles.css` | The visual system, both themes and the responsive layout. |
| `src/script.js` | The map, pan and zoom, the junction list, About, and Drive the loop. |
| `src/render.js` | Builds the list and "Good to know" HTML. Shared by the browser and the build. |
| `src/og.png` | The share image (1200×630), taken from `/?card`. |
| `data/junctions.js` | Junction content: places, sign destinations, notes, stretches and "Good to know". Edit this to change the words. |
| `data/geo.js` | Generated map geometry. Do not edit by hand. |
| `scripts/build_site.mjs` | Builds `site/`: the home page, 27 junction pages, a 404 page, `sitemap.xml` and `robots.txt`. |
| `scripts/fetch_osm.sh`, `scripts/build_geo.py` | Refresh the OpenStreetMap extracts and rebuild `data/geo.js`. |
| `scripts/build_artifact.py` | Bundles the built home page into one file for a Claude artifact preview. |
| `.github/workflows/pages.yml` | Builds and deploys to GitHub Pages on every push to `main`. |

To refresh the map data:

```sh
sh scripts/fetch_osm.sh && python3 scripts/build_geo.py
```

To regenerate the share image, with the local preview running:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --blink-settings=preferredColorScheme=1 --window-size=1200,630 --virtual-time-budget=4000 --screenshot=src/og.png "http://127.0.0.1:8765/?card"
```

## Deployment

Pushing to `main` runs the GitHub Actions workflow, which builds `site/` and
publishes it to GitHub Pages at <https://m60motorway.com>. The custom domain is
set in the repository's Pages settings; `src/CNAME` records it too.

DNS, at the registrar:

- `m60motorway.com`: `A` records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- `www.m60motorway.com`: a `CNAME` to `bigcub.github.io`, so `www` redirects to the apex.

After launch, add the site to Google Search Console and submit `https://m60motorway.com/sitemap.xml`.

## Sources

- Map geometry © OpenStreetMap contributors, available under the ODbL.
- Junction destinations and mileages from the Wikipedia junction list for the M60, which is built from driver location signs. Mileages for J3, J4, J15 and J25–27 are not published and are estimated from the map.
