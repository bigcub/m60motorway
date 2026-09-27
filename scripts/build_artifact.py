"""Bundle the site into one self-contained HTML fragment for a Claude artifact preview.

The artifact host supplies its own <html>, <head> and <body>, so this keeps the
head's title, font links and scripts, inlines the stylesheet and scripts, and
drops the outer document tags. Run from the repository root:

    node scripts/build_site.mjs && python3 scripts/build_artifact.py [output-path]

It bundles the built home page in site/. The default output is .artifact/index.html,
which git ignores.
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'site')


def read(rel):
    with open(os.path.join(ROOT, rel)) as f:
        return f.read()


html = read('index.html')
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body[^>]*>(.*?)</body>', html, re.S).group(1)

# keep the title, fonts and the theme boot script from the head; the host provides the meta tags
keep = [re.search(r'<title>.*?</title>', head, re.S).group(0)]
keep += re.findall(r'<link rel="preconnect"[^>]*>', head)
keep += [m for m in re.findall(r'<link rel="stylesheet" href="https://fonts[^>]*>', head)]
keep.append('<style>\n' + read('styles.css') + '\n</style>')
keep += re.findall(r'<script>.*?</script>', head, re.S)

body = re.sub(r'<script src="([^"]+)"></script>', lambda m: '<script>\n' + read(m.group(1)) + '\n</script>', body)

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', '.artifact', 'index.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w') as f:
    f.write('\n'.join(keep) + '\n' + body)
print('wrote', out)
