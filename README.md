# m60motorway.com

A map of the M60, Manchester's orbital motorway. All 27 junctions are numbered
on a full-window map drawn from OpenStreetMap. A floating panel lists the ring
stretch by stretch. Open a junction to see where its exit signs send you in each
direction and how far it is to the next one. About covers the road's quirks, such
as half junctions and the M62 overlap, and its history.

It is a small static site with no build step for the page itself.

## Local preview

```sh
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The page. |
| `styles.css` | The visual system, both themes and the responsive layout. |
| `script.js` | The map, pan and zoom, the junction list, About, and Drive the loop. |
| `data/junctions.js` | Junction content: places, sign destinations, notes, stretches and quirks. Edit this to change the words. |
| `data/geo.js` | Generated map geometry. Do not edit by hand. |
| `scripts/fetch_osm.sh` | Refreshes the OpenStreetMap extracts in `scripts/osm/`. |
| `scripts/build_geo.py` | Turns the extracts into `data/geo.js`. |
| `scripts/build_artifact.py` | Bundles the site into one file for a Claude artifact preview. |
| `CNAME` | The custom domain for GitHub Pages. |

To refresh the map data:

```sh
sh scripts/fetch_osm.sh && python3 scripts/build_geo.py
```

## Deploying to m60motorway.com

The repository is ready for GitHub Pages: `CNAME` holds `m60motorway.com` and
`.nojekyll` makes Pages serve the files as they are.

1. Push the repository to GitHub.
2. In the repository's **Settings → Pages**, publish from the `main` branch, root folder.
3. At the domain registrar, point the apex domain at GitHub Pages with four `A` records:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   (and optionally the `AAAA` records `2606:50c0:8000::153` to `2606:50c0:8003::153`).
4. Add a `CNAME` record for `www` pointing at `<github-username>.github.io`.
5. Once the certificate is issued, tick **Enforce HTTPS**.

## Sources

- Map geometry © OpenStreetMap contributors, available under the ODbL.
- Junction destinations and mileages from the Wikipedia junction list for the M60, which is built from driver location signs. Mileages for J3, J4, J15 and J25–27 are not published and are estimated from the map.
