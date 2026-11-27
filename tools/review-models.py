#!/usr/bin/env python3
# One canonical Blender studio for each registered asset, without a whole room build
USAGE = """One canonical Blender studio per registered asset, without building a whole room.
  python3 tools/review-models.py --list
  python3 tools/review-models.py telescope closed_book   # or no keys for the full set
Writes two views per asset in blender/out/model-review/<room>/. This is a review
list, not a placement inventory: see blender/audit_assets.py for actual use.
"""
import argparse
import ast
import os
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = root / 'blender'


def registered(file, registry):
    for node in ast.parse((source / file).read_text()).body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == registry for t in node.targets):
            value = node.value
            if isinstance(value, ast.Dict): yield from (k.value for k in value.keys)
            elif isinstance(value, ast.Call) and isinstance(value.func, ast.Name) and value.func.id == 'dict':
                yield from (kw.arg for kw in value.keywords)
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            fn = node.value.func
            if isinstance(fn, ast.Attribute) and fn.attr == 'update' and isinstance(fn.value, ast.Name) and fn.value.id == registry:
                yield from (kw.arg for kw in node.value.keywords)


def main():
    studios = {
        'lobby': ['pressure_door', *registered('assets_projection.py', 'ATRIUM_PROJECTION')],
        'about': list(registered('room_about.py', 'ASSETS')),
        'experience': list(registered('assets_projection.py', 'NAVIGATION_PROJECTION')),
        'projects': [*registered('assets_tech.py', 'TECH'), *registered('assets_exhibits.py', 'EXHIBIT_ASSETS')],
        'writing': [*registered('assets_reading.py', 'READING_ASSETS'), *registered('room_writing.py', 'ASSETS')],
    }
    parser = argparse.ArgumentParser(description=USAGE)
    parser.add_argument('--list', action='store_true'); parser.add_argument('assets', nargs='*')
    opts = parser.parse_args()
    flat = [k for keys in studios.values() for k in keys]
    if len(flat) != len(set(flat)): raise ValueError('Asset keys must have unique canonical studios')
    unknown = set(opts.assets) - set(flat)
    if unknown: parser.error('unknown assets: ' + ', '.join(sorted(unknown)))
    for room, keys in studios.items():
        names = [k for k in keys if not opts.assets or k in opts.assets]
        if not names: continue
        if opts.list:
            print(room + ':', ' '.join(names)); continue
        out = source / 'out' / 'model-review' / room; out.mkdir(parents=True, exist_ok=True)
        script = 'build_scene.py' if room == 'lobby' else f'room_{room}.py'
        images = []
        with tempfile.TemporaryDirectory(dir=out) as work:
            for name in names:
                with (out / f'{name}.log').open('w') as log:
                    subprocess.run([source / 'run.sh', '-b', '--python-exit-code', '2', '-P', source / script],
                                   env={**os.environ, 'ASSET': name, 'ASSET_OUT': work, 'SPP': os.environ.get('SPP', '12')},
                                   stdout=log, stderr=subprocess.STDOUT, check=True)
                for i in range(2):
                    image = Path(work) / f'asset_{name}_{i}.png'; image.replace(out / image.name)
                    if i == 0: images.append(out / image.name)
                print(room, name, flush=True)
        subprocess.run(['node', root / 'tools/montage.mjs', out / ('selection.png' if opts.assets else 'sheet.png'),
                        str(min(len(images), 4)), '320', *images], check=True)


if __name__ == '__main__': main()
