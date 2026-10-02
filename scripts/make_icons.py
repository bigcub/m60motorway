"""Draw the site icons from the ring mark: the M60 as a dusk-rose ring with a gold
dot at J1, on warm paper. Writes into src/, which the build copies to the site.

    python3 scripts/make_icons.py

Needs Pillow. Shapes are drawn at 8x and scaled down for smooth edges.
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')

PAPER = (245, 241, 232)
ROUTE = (164, 96, 107)
GOLD = (217, 154, 62)
SS = 8  # supersampling


def mark(size, scale=1.0, rounded=False, transparent=False, stroke=3.4, dot_r=4.4):
    """The mark on a square of `size` pixels. `scale` shrinks it toward the centre
    (for maskable icons); `rounded` paints the paper as a circle (for the favicon);
    a heavier `stroke` and `dot_r` keep tiny sizes legible."""
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0) if (transparent or rounded) else PAPER + (255,))
    d = ImageDraw.Draw(img)
    if rounded:
        d.ellipse([0, 0, S - 1, S - 1], fill=PAPER + (255,))
    u = S / 40 * scale  # drawn on a 40-unit grid, like the mark in the page title
    c = S / 2
    # ring: radius 13
    r_out, r_in = 13 * u + stroke / 2 * u, 13 * u - stroke / 2 * u
    d.ellipse([c - r_out, c - r_out, c + r_out, c + r_out], fill=ROUTE + (255,))
    d.ellipse([c - r_in, c - r_in, c + r_in, c + r_in], fill=(PAPER + (255,)) if not transparent else (0, 0, 0, 0))
    # J1: a gold dot to the south-east with a paper rim
    jx = jy = c + 9.2 * u
    rim, dot = dot_r * u + 0.8 * u, dot_r * u - 0.8 * u
    d.ellipse([jx - rim, jy - rim, jx + rim, jy + rim], fill=PAPER + (255,))
    d.ellipse([jx - dot, jy - dot, jx + dot, jy + dot], fill=GOLD + (255,))
    return img.resize((size, size), Image.LANCZOS)


def save(img, name, **kw):
    path = os.path.join(SRC, name)
    img.save(path, **kw)
    print('wrote', os.path.relpath(path, ROOT))


# Apple touch icon: opaque, square; iOS rounds the corners itself
save(mark(180).convert('RGB'), 'apple-touch-icon.png', optimize=True)
# Android and install icons
save(mark(192), 'icon-192.png', optimize=True)
save(mark(512), 'icon-512.png', optimize=True)
# maskable: the mark kept inside the central safe circle, on full-bleed paper
save(mark(512, scale=0.78), 'icon-maskable-512.png', optimize=True)
# favicon.ico for browsers and tools that ask for it, at 16, 32 and 48 px
big = mark(256, scale=1.18, rounded=True, stroke=4.6, dot_r=5.2)
save(big, 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
