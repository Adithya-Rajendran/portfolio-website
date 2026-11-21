#!/usr/bin/env python3
"""Render a contact sheet per reusable asset family, using the room's actual builders.
Run separately from a production bake (defaults to the local GPU). Fixed architecture
and inline exhibits are inspected in room views; dynamic models use asset.html.
Output: blender/out/model-review/<room>/, including two full-size stills per model.
"""
import ast
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
source = root / 'blender'


def registered(file, registry):
    tree = ast.parse((source / file).read_text())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == registry for t in node.targets):
            yield from (kw.arg for kw in node.value.keywords)
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            fn = node.value.func
            if isinstance(fn, ast.Attribute) and fn.attr == 'update' and isinstance(fn.value, ast.Name) and fn.value.id == registry:
                yield from (kw.arg for kw in node.value.keywords)


for room, names in [('writing', registered('room_writing.py', 'ASSETS')),
                    ('about', registered('room_about.py', 'ASSETS')),
                    ('projects', [*registered('assets_tech.py', 'TECH'), 'rover', 'arm'])]:
    out = source / 'out' / 'model-review' / room
    out.mkdir(parents=True, exist_ok=True)
    images = []
    for name in names:
        with (out / f'{name}.log').open('w') as log:
            subprocess.run([source / 'run.sh', '-b', '--python-exit-code', '2', '-P', source / f'room_{room}.py'],
                           env={**os.environ, 'ASSET': name, 'SPP': os.environ.get('SPP', '12')}, stdout=log, stderr=subprocess.STDOUT, check=True)
        for i in range(2):
            image = source / f'asset_{name}_{i}.png'
            image.replace(out / image.name)
            if i == 0: images.append(out / image.name)
        print(room, name, flush=True)
    subprocess.run(['node', root / 'tools/montage.mjs', out / 'sheet.png', '4', '320', *images], check=True)
