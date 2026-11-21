"""Census during an actual room build: named builder calls AND every linked Blender object.

blender/run.sh -b --python-exit-code 2 -P blender/audit_assets.py -- writing /tmp/writing.json
Runs the normal generator (.blend save, no render/pack). `path` is the observed builder
instance stack, outermost first. Objects made directly rather than by a mesh helper are
still enumerated by the final scene walk. Nothing is added to authored meshes or exports.
"""
from collections import Counter, defaultdict
import json
import os
from pathlib import Path
import re
import runpy
import sys

import bpy

room, output = sys.argv[sys.argv.index('--') + 1:]
rooms = {'lobby': 'build_scene', **{r: 'room_' + r for r in ('about', 'projects', 'experience', 'writing')}}
source = Path(__file__).resolve().with_name(rooms[room] + '.py')
if os.environ.get('ASSET'):
    raise ValueError('Unset ASSET to audit room placements rather than the studio bench')
counts = defaultdict(Counter)
ordinal = Counter()
stack = []
created = {}
sections = ['setup']
for line in source.read_text().splitlines():
    marker = re.match(r'^\s*# (?:={4,}|-{4,})\s*(\S.*)', line)
    sections.append(marker[1] if marker else sections[-1])


def anchor(frame):
    """The top-level placement in the ROOM script, even for a nested kit executed with exec()."""
    while frame:
        if frame.f_code.co_name == '<module>' and frame.f_code.co_filename == str(source):
            line = frame.f_lineno
            return sections[line], line
        frame = frame.f_back
    return 'direct scene object', 0


emitters = {'finish', 'quad', 'text3d', 'glow', 'spot'}


def trace(frame, event, arg):
    if event not in ('call', 'return'):
        return
    name = frame.f_code.co_name
    if name.startswith('a_') or name == 'pressure_door':
        if event == 'call':
            counts[name][stack[-1][0] if stack else 'room'] += 1
            ordinal[name] += 1
            stack.append((name, ordinal[name]))
        else:
            stack.pop()
    elif event == 'return' and name in emitters:
        ob = arg if arg is not None else frame.f_locals.get('o')
        if isinstance(ob, bpy.types.Object):
            created[ob.as_pointer()] = (tuple(stack), *anchor(frame))


sys.setprofile(trace)
try:
    runpy.run_path(str(source), run_name='__main__')
finally:
    sys.setprofile(None)
objects = []
for ob in sorted(bpy.context.scene.objects, key=lambda o: o.name):
    coll = sorted(c.name for c in ob.users_collection)
    default_section = 'exterior sky' if 'Outside' in coll else 'direct scene object'
    path, section, line = created.get(ob.as_pointer(), ((), default_section, 0))
    objects.append(dict(name=ob.name, type=ob.type, section=section, line=line, path=path,
                        collections=coll, grp=ob.get('grp',''), em=ob.get('em',''), fx=ob.get('fx','')))
Path(output).write_text(json.dumps({'room': room, 'calls_by_parent': counts, 'objects': objects}, separators=(',',':')) + '\n')
