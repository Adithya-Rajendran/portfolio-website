#!/usr/bin/env python3
"""Build the as-authored parts inspector from five complete blender/audit_assets.py traces.
  python3 tools/scene-parts.py /path/to/traces
Emits an entirely static HTML page plus an exact, compressed object table per room.
Counts end-of-build scene objects, not helper calls, tiny materials, triangles or three.js nodes.
"""
from collections import Counter, defaultdict
import csv
import gzip
from html import escape
from io import StringIO
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ROOMS = {'lobby':'Atrium', 'about':'Observation Lounge', 'projects':'Fabrication', 'experience':'Navigation', 'writing':'Library'}
OUT = ROOT / 'public/asset-catalogue'
MOTION = json.loads((ROOT / 'docs/room-motion.json').read_text())
SAMPLES = [json.loads(line) for line in (ROOT / 'docs/motion-sample.jsonl').read_text().splitlines()]


def key(name):
    return 'arm' if name == 'a_manipulator' else name.removeprefix('a_')


def pattern(name):
    # Display shorthand, NOT a model ID. Retain the full object names in the download.
    stem = re.sub(r'\.\d{3,}$', '', name)
    return re.sub(r'-?\d+(?:\.\d+)?', '#', stem)


def groups(rows):
    tally = defaultdict(list)
    for ob in rows:
        chain = tuple(key(f) for f,_ in ob['path'])
        tally[(chain, pattern(ob['name']))].append(ob)
    return tally


def table_row(cells, header=False):
    tag = 'th' if header else 'td'
    return '<tr>' + ''.join(f'<{tag}>{escape(str(c))}</{tag}>' for c in cells) + '</tr>'


def table(headers, rows):
    return '<div class="scroll"><table><thead>'+table_row(headers,True)+'</thead><tbody>'+''.join(table_row(r) for r in rows)+'</tbody></table></div>'


def write_exact(room, rows):
    buf = StringIO(); wr = csv.writer(buf, delimiter='\t', lineterminator='\n')
    wr.writerow(['object','type','builder_instances_outer_to_inner','placement_section','placement_line',
                 'collections','bake_group','emission_key','fx_key'])
    for ob in rows:
        path = '/'.join(f'{key(n)}[{i}]' for n,i in ob['path'])
        wr.writerow([ob['name'],ob['type'],path,ob['section'],ob['line'] or '',','.join(ob['collections']),ob['grp'],ob['em'],ob['fx']])
    (OUT / f'{room}-objects.tsv.gz').write_bytes(gzip.compress(buf.getvalue().encode(),mtime=0))


def detail(title, rows):
    data = []
    for (chain,label), obs in sorted(groups(rows).items(), key=lambda item:(-len(item[1]),item[0])):
        example = obs[0]
        data.append((len(obs), label, ' › '.join(chain[1:]) or '—', example['name'],
                     ', '.join(sorted({str(o['line']) for o in obs if o['line']},key=int))))
    return (f'<details><summary>{escape(title)} <small>· {len(rows):,} mesh objects</small></summary>' +
            table(['Count','Part label¹','Nested builder','Example source object','Room script line(s)'],data)+'</details>')


def main(folder):
    OUT.mkdir(parents=True, exist_ok=True)
    traces = {r:json.loads((folder / f'{r}.json').read_text()) for r in ROOMS}
    counts, raw, sections, totals = [], [], [], Counter()
    if set(MOTION) != set(ROOMS): raise ValueError('Motion audit missing room')
    for room,title in ROOMS.items():
        t = traces[room]; obs = t['objects']; by_type = Counter(o['type'] for o in obs)
        assert t['room'] == room and len({ob['name'] for ob in obs}) == len(obs)
        by_asset, inline = defaultdict(list), defaultdict(list)
        for ob in obs:
            if ob['type'] == 'MESH':
                if not ob['line'] and 'Outside' not in ob['collections']:
                    raise ValueError(f"{room}/{ob['name']}: untraced interior mesh; trace its emitter before assigning an owner")
                if ob['path']: by_asset[ob['path'][0][0]].append(ob)
                else: inline[ob['section']].append(ob)
        na, ni = sum(map(len,by_asset.values())), sum(map(len,inline.values()))
        assert na + ni == by_type['MESH']
        other = len(obs) - by_type['MESH'] - by_type['LIGHT'] - by_type['CAMERA']
        line = [room,len(obs),by_type['MESH'],na,ni,by_type['LIGHT'],by_type['CAMERA'],other]
        raw.append(line); counts.append([title,*line[1:]]); totals.update(by_type); write_exact(room,obs)
        part = [f'<section id="{room}"><h2>{title}</h2><p><a href="{room}-objects.tsv.gz" download>Every named Blender object · TSV.gz</a> · '
                f'<a href="index.html#{room}">Studio thumbnails</a></p>',
                '<h3>What moves in the browser?</h3>']
        samples = [s for s in SAMPLES if s['room'] == room]
        if not any(s['phase'] == 'idle' for s in samples): raise ValueError(f'No idle sample: {room}')
        part.append(table(['Sample in the packed preview','Sampled frames','Changing local transforms','Morphing meshes'],
                          [(s['phase'],s['frames'],s['localTransforms'],s['morphing']) for s in samples]))
        part.append('<dl>')
        for sys_ in MOTION[room]:
            mode, system = escape(sys_['mode']), escape(sys_['system'])
            part.append(f'<dt><b>{system}</b> <small>{mode}</small></dt><dd>{escape(sys_["parts"])} '
                        f'<details><summary>Source</summary><code>{escape(sys_["evidence"])}</code></details></dd>')
        part.extend(['</dl><h3>Meshes inside named builders</h3>',
                     '<p>Totals include descendants. Inside each row, pieces of a nested assembly appear once, under their innermost builder.</p>'])
        for k, rows in sorted(by_asset.items(),key=lambda item:-len(item[1])):
            direct = t['calls_by_parent'][k]['room']
            part.append(detail(f'{key(k)} ×{direct}', rows))
        part += ['<h3>Meshes outside named builders</h3>',
                 '<p>Grouped by the room script section that placed them; direct exterior meshes are included. Refer to the room line or exact object download to locate them.</p>']
        for name,rows in sorted(inline.items(),key=lambda item:-len(item[1])): part.append(detail(name,rows))
        part.append('</section>'); sections.extend(part)

    cols = ['room','all_objects','meshes','meshes_inside_builders','meshes_outside_builders','lights','cameras','other_objects']
    with (ROOT / 'docs/scene-parts.tsv').open('w') as f:
        w = csv.writer(f,delimiter='\t',lineterminator='\n'); w.writerow(cols); w.writerows(raw)
    page = ['''<!DOCTYPE html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Arcadia · as-built parts and motion</title>
<style>*{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;background:#13191f;color:#ecf0ec;max-width:76rem;margin:auto;padding:2rem 1rem}a{color:#a6e0db}nav{display:flex;flex-wrap:wrap;gap:1rem}h2{border-top:1px solid #43515a;padding-top:1.2rem}small{font-weight:normal;color:#afc8c9}.scroll{overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #43515a;padding:.28rem .55rem;text-align:left}dt{margin-top:.7rem}dd{margin:.2rem 0 .5rem 1rem;max-width:72rem}summary{cursor:pointer}details{margin:.22rem 0}code{overflow-wrap:anywhere}</style><main>
<a href="index.html">← Named asset catalogue</a><h1>As-built parts and motion</h1>''',
            f'<p><strong>{sum(totals.values()):,} authored Blender objects, including {totals["MESH"]:,} mesh objects.</strong> '
            'One mesh object may be a complete shell, one hinge, or many leaves. These are counts before the bake joins static geometry, '
            'not unique reusable designs, browser draw calls or articulated joints. Lights, cameras and helpers are listed separately. '
            'Live three.js models and shader effects are described below; they are not in the Blender totals.</p>',
            table(['Room','All objects','Mesh objects','In builders','Outside builders','Lights','Cameras','Other'],counts),
            '<p>¹ In the grouped view, <code>#</code> stands for a numeric index and Blender’s duplicate suffixes are dropped. '
            'Grouping labels are for browsing, not a count of unique designs. The downloadable lists preserve every original name, instance path and tag.</p>',
            '<p>The motion tables are Chromium observations at the room overview (960×540, tier 1, scale 0.7, '
            'no reduced-motion preference). They count nodes changing their <em>own</em> position, rotation or scale, '
            'not descendants carried by a parent, camera motion, particles animated in a shader, lighting or changing screens. '
            'A turning sky or projected marker is a changing transform, not a moving piece of furniture.</p>',
            '<nav>'+ ' '.join(f'<a href="#{r}">{t}</a>' for r,t in ROOMS.items())+'</nav>',*sections,'</main></html>\n']
    (OUT / 'parts.html').write_text('\n'.join(page))
    print(f'{sum(totals.values()):,} scene objects; {totals["MESH"]:,} meshes; {sum(r[4] for r in raw):,} meshes outside named builders')


if __name__ == '__main__': main(Path(sys.argv[1]))
