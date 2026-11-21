"""Trace actual builder calls during a normal room build, not entries in an ASSET bench.

./blender/run.sh -b --python-exit-code 2 -P blender/audit_assets.py -- writing /tmp/writing.json
Runs the generator (including its normal local .blend save). No renders or packing.
Top-level counts are room placements; nested counts are constituent assets inside another
counted family. Mesh primitives, layout helpers, and live three.js models aren't placements here.
"""
import collections
import json
import os
from pathlib import Path
import runpy
import sys

room, output = sys.argv[sys.argv.index('--') + 1:]
rooms = {'lobby': 'build_scene', **{r: 'room_' + r for r in ('about', 'projects', 'experience', 'writing')}}
source = Path(__file__).resolve().parent / (rooms[room] + '.py')
if os.environ.get('ASSET'):
    raise ValueError('Unset ASSET to audit room placements rather than the studio bench')
counts = collections.defaultdict(collections.Counter)
stack = []


def trace(frame, event, arg):
    if event not in ('call', 'return'):
        return
    name = frame.f_code.co_name
    if not (name.startswith('a_') or name == 'pressure_door'):
        return
    if event == 'call':
        counts[name][stack[-1] if stack else 'room'] += 1
        stack.append(name)
    else:
        stack.pop()


sys.setprofile(trace)
try:
    runpy.run_path(str(source), run_name='__main__')
finally:
    sys.setprofile(None)
Path(output).write_text(json.dumps({'room': room, 'calls_by_parent': counts}, sort_keys=True, indent=2) + '\n')
