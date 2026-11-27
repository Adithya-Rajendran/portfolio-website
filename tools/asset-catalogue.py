#!/usr/bin/env python3
# Static visual inventory made from measured placements and canonical studio stills
import csv
from html import escape
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
rooms = {'lobby': 'Atrium', 'about': 'Observation Lounge', 'projects': 'Fabrication',
         'experience': 'Navigation', 'writing': 'Library'}
out = root / 'public/asset-catalogue'
imgs = root / 'blender/out/model-review'
with (root / 'docs/asset-placements.tsv').open() as f: rows = list(csv.DictReader(f, delimiter='\t'))
listing = subprocess.check_output([sys.executable, root / 'tools/review-models.py', '--list'], text=True)
reverse = {'bay', 'armchair', 'frame', 'sideboard', 'bookend', 'shelf_volume'}
views = {name: imgs / studio / f'asset_{name}_{int(name in reverse)}.png' for line in listing.splitlines()
         for studio, keys in [line.split(': ')] for name in keys.split()}
if set(views) != {r['bench_key'] for r in rows}: raise ValueError('Inventory / bench keys disagree')
for path in views.values():
    if not path.is_file(): raise FileNotFoundError(f'{path}: run tools/review-models.py first')
out.mkdir(parents=True, exist_ok=True)
for name, path in views.items():
    subprocess.run([Path.home() / '.local/opt/webp/bin/cwebp', '-quiet', '-resize', '320', '240', '-q', '80',
                    path, '-o', out / f'{name}.webp'], check=True)

roomsets = {room: {r['bench_key'] for r in rows if int(r[room])} for room in rooms}
shared = sum(sum(r['bench_key'] in s for s in roomsets.values()) > 1 for r in rows)
page = ['''<!DOCTYPE html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arcadia Station · object catalogue</title><style>
*{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;background:#13191f;color:#ecf0ec;max-width:74rem;margin:auto;padding:2rem 1rem}a{color:#a6e0db}nav{display:flex;gap:1rem;flex-wrap:wrap}h1,h2{line-height:1.15}section{padding:1rem 0}table{border-collapse:collapse}th,td{border:1px solid #43515a;padding:.3rem .6rem;text-align:center}th:first-child{text-align:left}.scroll{overflow:auto}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(12rem,1fr));gap:.7rem}figure{margin:0;padding:.55rem;background:#222c32;border-radius:4px}img{width:100%;height:auto;display:block}figcaption{padding:.35rem .12rem}small{display:block;color:#c4d1d4}code{overflow-wrap:anywhere}</style>
<main><a href="../">← Station</a><h1>Object catalogue</h1><p><b><a href="parts.html">All scene parts and what actually moves →</a></b> · includes the inline geometry and an exact object list for each room.</p>''',
        f'<p>{len(rows)} named Blender asset families actually built across five rooms; {shared} appear in more than one. '
        'One representative studio view per family, not a photograph of each placement. Counts include nested parts, '
        'so a stack and its constituent books are not independent scene placements. Inline architecture and live holograms are not counted here.</p>',
        '<nav>' + ' '.join(f'<a href="#{k}">{v}</a>' for k,v in rooms.items()) + '</nav>',
        '<h2>Exact family overlap</h2><div class="scroll"><table><caption>Shared builders; diagonal = distinct families in that room.</caption><thead><tr><th>Room</th>'
        + ''.join(f'<th>{v}</th>' for v in rooms.values()) + '</tr></thead><tbody>']
for k,v in rooms.items():
    page.append(f'<tr><th scope="row">{v}</th>' + ''.join(f'<td>{len(roomsets[k] & s)}</td>' for s in roomsets.values()) + '</tr>')
page.append('</tbody></table></div>')
for room, title in rooms.items():
    page.append(f'<section id="{room}"><h2>{title} · {len(roomsets[room])} families</h2>'
                f'<p><a href="parts.html#{room}">Assembly breakdown, inline objects and motion in this room</a></p><div class="grid">')
    for r in sorted(rows, key=lambda r: r['bench_key']):
        name = r['bench_key']
        if name not in roomsets[room]: continue
        nested = [k.split('/', 1)[1].replace('a_', '', 1) for k in r['of_which_nested'].split(', ') if k.startswith(room + '/')]
        uses = [title for k,title in rooms.items() if k != room and name in roomsets[k]]
        note = ('Nested under '+', '.join(nested)+'. ' if nested else '') + ('Also: '+', '.join(uses) if uses else '')
        page.append(f'<figure><img src="{name}.webp" loading="lazy" width="320" height="240" alt="Studio render: {name}">'
                    f'<figcaption><b>{name.replace("_", " ")}</b> ×{r[room]}<small>{escape(note)}</small>'
                    f'<details><summary>Builder</summary><small><code>{escape(r["definition"])}</code></small></details></figcaption></figure>')
    page.append('</div></section>')
(out / 'index.html').write_text('\n'.join(page + ['</main></html>\n']))
print(f'{out}: {len(rows)} studio thumbnails')
