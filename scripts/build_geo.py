"""Build data/geo.js from the OpenStreetMap extracts in scripts/osm/.

Projects the motorways, rivers and junctions onto a flat plane (40 map units
per km), simplifies the lines, and works out a smoothed centreline of the ring
so the page can measure distance along it. Run from the repository root:

    python3 scripts/build_geo.py
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OSM = os.path.join(ROOT, 'scripts', 'osm')

LAT0, LON0 = 53.475, -2.252          # projection origin, near the middle of the ring
KX = 111.320 * math.cos(math.radians(LAT0))
KY = 110.574
S = 40.0                              # map units per km
CX, CY = 500, 480


def P(lat, lon):
    return ((lon - LON0) * KX * S + CX, -(lat - LAT0) * KY * S + CY)


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for i, (x, y) in enumerate(pts[1:-1], 1):
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def path(pts):
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)


def load(name):
    with open(os.path.join(OSM, name)) as f:
        return json.load(f)['elements']


# ---------- motorways ----------
ring_ways, spur_ways = [], {}
for w in load('motorways.json'):
    ref = w['tags'].get('ref', '')
    pts = [P(g['lat'], g['lon']) for g in w['geometry']]
    if 'M60' in ref.split(';'):
        ring_ways.append(pts)
    else:
        spur_ways.setdefault(ref.split(';')[0], []).append(pts)

allp = [p for w in ring_ways for p in w]
mx = sum(p[0] for p in allp) / len(allp)
my = sum(p[1] for p in allp) / len(allp)

# Centreline: average the ring's points in 1-degree bins around the middle, then
# smooth. With y pointing down, increasing angle runs clockwise on screen, which
# matches the junction numbering.
NB = 360
bins = [[] for _ in range(NB)]
for x, y in allp:
    a = math.atan2(y - my, x - mx)
    bins[int((a + math.pi) / (2 * math.pi) * NB) % NB].append((x, y))
raw = [(sum(p[0] for p in b) / len(b), sum(p[1] for p in b) / len(b)) for b in bins if b]
n = len(raw)
cl = []
for i in range(n):
    pts = [raw[(i + k) % n] for k in (-2, -1, 0, 1, 2)]
    cl.append((sum(p[0] for p in pts) / 5, sum(p[1] for p in pts) / 5))

cum = [0.0]
for i in range(n):
    a, b = cl[i], cl[(i + 1) % n]
    cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))


def snap(pt):
    best = None
    for i in range(n):
        a, b = cl[i], cl[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0, min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / ((dx * dx + dy * dy) or 1e-9)))
        q = (a[0] + t * dx, a[1] + t * dy)
        d = math.hypot(q[0] - pt[0], q[1] - pt[1])
        if best is None or d < best[0]:
            best = (d, i, t, q)
    return best


# ---------- junctions ----------
# Junction positions from the Wikipedia junction list, snapped to the centreline.
WIKI = [(53.4091, -2.1742), (53.4017, -2.2100), (53.3989, -2.2262), (53.3991, -2.2377), (53.4139, -2.2649),
        (53.4267, -2.2939), (53.4370, -2.3151), (53.4409, -2.3356), (53.4579, -2.3392), (53.4643, -2.3570),
        (53.4763, -2.3736), (53.4876, -2.3768), (53.5012, -2.3838), (53.5130, -2.3697), (53.5235, -2.3604),
        (53.5262, -2.3371), (53.5388, -2.2889), (53.5498, -2.2605), (53.5400, -2.2372), (53.5338, -2.2069),
        (53.5269, -2.1601), (53.5200, -2.1434), (53.4799, -2.1173), (53.4568, -2.1361), (53.4251, -2.1258),
        (53.4204, -2.1376), (53.4166, -2.1488)]
J = []
for k, (la, lo) in enumerate(WIKI):
    _, i, t, q = snap(P(la, lo))
    J.append({'n': k + 1, 'x': q[0], 'y': q[1], 'seg': i, 's': cum[i] + t * (cum[i + 1] - cum[i])})

# Official mileage where Wikipedia gives it; the gaps are interpolated along the geometry.
OFFICIAL = {1: 0, 2: 1.5, 5: 4.5, 6: 6.0, 7: 6.8, 8: 7.5, 9: 9.3, 10: 10.3, 11: 11.4, 12: 12.2, 13: 13.0,
            14: 14.1, 16: 16.3, 17: 18.5, 18: 19.8, 19: 21.0, 20: 22.6, 21: 24.7, 22: 26.3, 23: 28.6,
            24: 30.6, 28: 36.1}
geo = {j['n']: ((j['s'] - J[0]['s']) % cum[-1]) for j in J}
geo[28] = cum[-1]
known = sorted(OFFICIAL)
for j in J:
    k = j['n']
    if k in OFFICIAL:
        j['mi'] = OFFICIAL[k]
        continue
    a = max(v for v in known if v < k)
    b = min(v for v in known if v > k)
    f = (geo[k] - geo[a]) / (geo[b] - geo[a])
    j['mi'] = round(OFFICIAL[a] + f * (OFFICIAL[b] - OFFICIAL[a]), 1)

# ---------- clipping ----------
xs = [p[0] for p in allp]
ys = [p[1] for p in allp]
M = 150
VB = [min(xs) - M, min(ys) - M, (max(xs) - min(xs)) + 2 * M, (max(ys) - min(ys)) + 2 * M]
rmax = max(math.hypot(x - mx, y - my) for x, y in allp)
CLIP = rmax + 95


def runs_inside(pts, inside):
    out, cur = [], []
    for p in pts:
        if inside(p):
            cur.append(p)
        else:
            if len(cur) > 1:
                out.append(cur)
            cur = []
    if len(cur) > 1:
        out.append(cur)
    return out


def in_clip(p, pad=0):
    return math.hypot(p[0] - mx, p[1] - my) < CLIP - pad


ring_d = ''.join(path(rdp(w, 0.6)) for w in ring_ways)
spurs = {}
for ref, ws in spur_ways.items():
    d = ''.join(path(rdp(r, 0.6)) for w in ws for r in runs_inside(w, in_clip))
    if d:
        spurs[ref] = d

# Spur labels: the farthest in-clip point from the middle (per side for the M62).
def far(pts):
    return max(pts, key=lambda p: math.hypot(p[0] - mx, p[1] - my))


def near(pts):
    return min(pts, key=lambda p: math.hypot(p[0] - mx, p[1] - my))


spur_labels = []
for ref, ws in spur_ways.items():
    pts = [p for w in ws for p in w if in_clip(p, 50)]
    if ref == 'M62':
        spur_labels.append(['M62', *far([p for p in pts if p[0] < mx])])
        spur_labels.append(['M62', *far([p for p in pts if p[0] > mx])])
    elif ref == 'M602':
        spur_labels.append(['M602', *near(pts)])
    else:
        spur_labels.append([ref, *far(pts)])

# ---------- rivers ----------
def inbox(p):
    return VB[0] - 20 < p[0] < VB[0] + VB[2] + 20 and VB[1] - 20 < p[1] < VB[1] + VB[3] + 20


rivers, river_pts = {}, {}
for w in load('rivers.json'):
    name = w['tags']['name']
    pts = [P(g['lat'], g['lon']) for g in w['geometry']]
    for r in runs_inside(pts, inbox):
        rivers[name] = rivers.get(name, '') + path(rdp(r, 0.8))
        river_pts.setdefault(name, []).append(r)

# River labels: the point on each river nearest a chosen spot, turned to follow the water.
RIVER_LABELS = {'River Mersey': (53.4395, -2.3050), 'River Irwell': (53.4990, -2.2800),
                'Manchester Ship Canal': (53.4700, -2.3300), 'River Tame': (53.4560, -2.1250)}
river_labels = []
for name, (la, lo) in RIVER_LABELS.items():
    tx, ty = P(la, lo)
    best = None
    for run in river_pts.get(name, []):
        for i in range(2, len(run) - 2):
            d = math.hypot(run[i][0] - tx, run[i][1] - ty)
            if best is None or d < best[0]:
                best = (d, run, i)
    if not best:
        continue
    _, run, i = best
    a, b = run[max(0, i - 6)], run[min(len(run) - 1, i + 6)]
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    if ang > 90:
        ang -= 180
    if ang < -90:
        ang += 180
    river_labels.append([name, round(run[i][0], 1), round(run[i][1], 1), round(ang, 1)])

# ---------- places ----------
PLACES = [('Manchester', 53.4794, -2.2453), ('Salford', 53.4880, -2.2920), ('Stockport', 53.4065, -2.1600),
          ('Sale', 53.4246, -2.3222), ('Stretford', 53.4466, -2.3087), ('Eccles', 53.4832, -2.3346),
          ('Urmston', 53.4487, -2.3547), ('Swinton', 53.5122, -2.3412), ('Prestwich', 53.5333, -2.2833),
          ('Middleton', 53.5550, -2.1870), ('Oldham', 53.5409, -2.1114), ('Ashton-under-Lyne', 53.4897, -2.0952),
          ('Denton', 53.4554, -2.1122), ('Didsbury', 53.4166, -2.2310), ('Cheadle', 53.3934, -2.2130),
          ('Worsley', 53.5010, -2.4000), ('Whitefield', 53.5500, -2.2980), ('Failsworth', 53.5102, -2.1575),
          ('Bredbury', 53.4230, -2.1100), ('Wythenshawe', 53.3920, -2.2640), ('Trafford Centre', 53.4668, -2.3474),
          ('Old Trafford', 53.4631, -2.2913), ('Etihad Stadium', 53.4831, -2.2004),
          ('Stockport Pyramid', 53.4102, -2.1716), ('Heaton Park', 53.5370, -2.2540)]
places = {name: [round(v, 1) for v in P(la, lo)] for name, la, lo in PLACES}

out = {
    'vb': [round(v, 1) for v in VB],
    'ctr': [round(mx, 1), round(my, 1)],
    'clip': round(CLIP, 1),
    'unitsPerMile': round(S * 1.609344, 2),
    'ring': ring_d,
    'spurs': spurs,
    'spurLabels': [[r, round(x, 1), round(y, 1)] for r, x, y in spur_labels],
    'rivers': rivers,
    'riverLabels': river_labels,
    'cl': [[round(x, 1), round(y, 1)] for x, y in cl],
    'J': [{'n': j['n'], 'x': round(j['x'], 1), 'y': round(j['y'], 1), 'seg': j['seg'], 'mi': j['mi']} for j in J],
    'places': places,
}
with open(os.path.join(ROOT, 'data', 'geo.js'), 'w') as f:
    f.write('// Generated by scripts/build_geo.py from OpenStreetMap data (c) OpenStreetMap contributors, ODbL.\n')
    f.write('window.GEO = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print('wrote data/geo.js:', sum(len(v) for v in rivers.values()) + len(ring_d), 'chars of path data;',
      len(river_labels), 'river labels')
