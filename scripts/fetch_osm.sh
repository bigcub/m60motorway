#!/bin/sh
# Refresh the OpenStreetMap extracts in scripts/osm/ from the Overpass API.
# Run from the repository root, then rebuild the map data:
#   sh scripts/fetch_osm.sh && python3 scripts/build_geo.py
set -e
OUT=scripts/osm
API=https://overpass-api.de/api/interpreter
UA="m60motorway.com map builder"

fetch() {
  curl -sf -m 180 -A "$UA" --data-urlencode "data=$2" "$API" -o "$OUT/$1"
  echo "fetched $1"
}

fetch motorways.json '[out:json][timeout:120];
way["highway"="motorway"]["ref"~"M60|M56|M62|M61|M66|M67|M602"](53.30,-2.55,53.62,-1.95);
out geom tags;'

fetch rivers.json '[out:json][timeout:120];
way["waterway"~"river|canal"]["name"~"^(River Mersey|River Irwell|River Tame|River Goyt|Manchester Ship Canal|River Medlock|River Irk)$"](53.33,-2.50,53.60,-2.03);
out geom tags;'

fetch junctions.json '[out:json][timeout:120];
way["highway"="motorway"]["ref"~"M60"](53.30,-2.55,53.62,-1.95)->.m;
node(w.m)["highway"="motorway_junction"];
out tags center;'
