#!/usr/bin/env python3
"""Membangun docs/index.html (GitHub Pages) = apps-script/Index.html + backend *.gs asli + runtime demo.
Jalankan:  python3 scripts/build_pages.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
gs_dir = root / 'apps-script'
order = ['Config', 'Core', 'Setup', 'Auth', 'ApiNilai', 'Generator', 'ApiRapor', 'Admin', 'Cetak', 'DataRapor', 'SeedData']
gas = '\n'.join((gs_dir / f'{n}.gs').read_text(encoding='utf8') for n in order)
names = sorted(set(re.findall(r'^function\s+([A-Za-z0-9_]+)\s*\(', gas, re.M)))
api = ', '.join(f'{n}: {n}' for n in names if not n.endswith('_'))
rt = (root / 'scripts' / 'demo-runtime.js').read_text(encoding='utf8').replace('/*__GAS__*/', gas).replace('/*__API__*/', api)
html = (gs_dir / 'Index.html').read_text(encoding='utf8')
assert '<!--DEMO_RUNTIME-->' in html, 'penanda <!--DEMO_RUNTIME--> tidak ada di Index.html'
out = html.replace('<!--DEMO_RUNTIME-->', '<script src="config.js"></script>\n<script>\n' + rt.replace('</script>', '<\\/script>') + '\n</script>')
(root / 'docs').mkdir(exist_ok=True)
(root / 'docs' / 'index.html').write_text(out, encoding='utf8')
print('docs/index.html dibuat,', len(out) // 1024, 'KB;', len(names), 'fungsi backend')
