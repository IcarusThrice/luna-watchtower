#!/usr/bin/env python3
"""Builds dist/index.html (deployable page) and build/luna-watchtower.html (preview body) from src/page.html."""
import json, pathlib, sys
root = pathlib.Path(__file__).parent
src = (root / 'src' / 'page.html').read_text()
lst = json.loads((root / 'data' / 'restricted.json').read_text())
marker = '/*__LIST__*/{"v":[],"a":[]}'
assert src.count(marker) == 1
page = src.replace(marker, json.dumps(lst, separators=(',', ':')))
(root / 'build').mkdir(exist_ok=True); (root / 'dist').mkdir(exist_ok=True)
(root / 'build' / 'luna-watchtower.html').write_text(page)
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="description" content="Security watch for Terra phoenix-1: unbonding queue, restricted addresses, wallet permission checkup and quantum readiness.">'
        '<style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>')
(root / 'dist' / 'index.html').write_text(head + page + '</body></html>\n')
print('built', len(page), 'bytes;', len(lst['v']), 'affected,', len(lst['a']), 'attacker-associated')
