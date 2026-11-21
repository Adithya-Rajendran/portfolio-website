#!/usr/bin/env python3
"""Produce the TSV placement catalogue from the five outputs of blender/audit_assets.py.
Usage: python3 tools/asset-inventory.py /path/to/traces > docs/asset-placements.tsv
The trace directory must contain lobby.json, about.json, projects.json, experience.json, writing.json.
"""
import ast
import csv
import json
from pathlib import Path
import sys

rooms = ('lobby', 'about', 'projects', 'experience', 'writing')
source = Path(__file__).resolve().parents[1] / 'blender'
folder = Path(sys.argv[1]); traces = {}
for room in rooms:
    trace = json.loads((folder / (room + '.json')).read_text())
    if trace['room'] != room: raise ValueError(f'Wrong trace for {room}')
    traces[room] = trace['calls_by_parent']

families = sorted(set().union(*(set(traces[r]) for r in rooms)))
locations = {name: [] for name in families}
for f in source.glob('*.py'):
    for fn in ast.parse(f.read_text()).body:
        if isinstance(fn, ast.FunctionDef) and fn.name in locations: locations[fn.name].append(f.name)
writer = csv.writer(sys.stdout, delimiter='\t', lineterminator='\n')
writer.writerow(['bench_key', 'definition', *rooms, 'of_which_nested'])
for fn in families:
    if len(locations[fn]) != 1: raise ValueError(f'Ambiguous or missing builder: {fn}: {locations[fn]}')
    key = 'arm' if fn == 'a_manipulator' else fn.removeprefix('a_')
    by_room = [traces[r].get(fn, {}) for r in rooms]
    nested = [f'{r}/{parent}:{count}' for r, calls in zip(rooms, by_room)
              for parent, count in sorted(calls.items()) if parent != 'room']
    writer.writerow([key, f'blender/{locations[fn][0]}:{fn}', *(sum(c.values()) for c in by_room), ', '.join(nested) or '-'])
