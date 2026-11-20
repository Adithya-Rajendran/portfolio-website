#!/usr/bin/env python3
"""Turn a bake (assets-src/<room>/, written by blender/bake.py) into what the site serves (public/assets/<room>/).
  tools/pack.py [room ...]
Textures -> KTX2: block-compressed on the GPU (a quarter to an eighth of the memory of RGBA8), mipmaps included, and
the layers of one group (orrery phases _c0.., sky angles _s0..) packed into a single array texture.
Geometry -> meshopt-compressed GLB.   Needs ktx (KTX-Software), dwebp (libwebp) and gltfpack under ~/.local/opt."""
import os, re, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OPT = os.path.expanduser('~/.local/opt')
KTX, DWEBP, GLTFPACK = f'{OPT}/ktx/bin/ktx', f'{OPT}/webp/bin/dwebp', f'{OPT}/gltfpack/gltfpack'
ENV = dict(os.environ, LD_LIBRARY_PATH=f'{OPT}/ktx/lib')
# Light (dark, smooth) -> UASTC + Zstandard: near-lossless, 8 bits per pixel on the GPU. BasisLZ/ETC1S is a fifth of the
# download but turns such light into coloured blocks; it is only used for the surface-colour atlases (_a), which
# are flat colour and only ever seen multiplied by sunlight.
UASTC = ['--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18']
ETC1S = ['--encode', 'basis-lz', '--qlevel', '255', '--clevel', '3']

def run(*cmd):
    r = subprocess.run(cmd, env=ENV, capture_output=True, text=True)
    if r.returncode: sys.exit('FAILED %s\n%s' % (' '.join(cmd), r.stdout + r.stderr))

def pack(room):
    src, dst = f'{ROOT}/assets-src/{room}', f'{ROOT}/public/assets/{room}'
    shutil.rmtree(dst, ignore_errors=True); os.makedirs(f'{dst}/tex')
    tmp = tempfile.mkdtemp()
    jobs = {}                                                        # output name -> (kind, [source images, in layer order])
    for f in sorted(os.listdir(f'{src}/tex')):
        name, ext = os.path.splitext(f)
        if ext == '.png': shutil.copy(f'{src}/tex/{f}', f'{dst}/tex/{f}'); continue
        m = re.fullmatch(r'(.+)_([cs])(\d)', name)
        if m: jobs.setdefault(f'{m[1]}_{m[2]}', ('layers', []))[1].append(name)
        else: jobs[name] = ('albedo' if name.endswith('_a') else 'backdrop' if name == 'backdrop' else 'base', [name])
    def one(item):
        out, (kind, names) = item
        pngs = []
        for n in names:
            pngs.append(f'{tmp}/{n}.png')                            # the backdrop is the only image stored top row first
            run(DWEBP, '-quiet', *(['-flip'] if kind == 'backdrop' else []), f'{src}/tex/{n}.webp', '-o', pngs[-1])
        run(KTX, 'create', '--format', 'R8G8B8_UNORM', '--assign-tf', 'linear', '--generate-mipmap',
            *(['--layers', str(len(pngs))] if kind == 'layers' else []), *(ETC1S if kind == 'albedo' else UASTC), *pngs, f'{dst}/tex/{out}.ktx2')
    with ThreadPoolExecutor(3) as ex: list(ex.map(one, jobs.items()))
    # geometry: keep node names, extras and unused attributes (lightmap UVs, vertex colours); lightmap UVs stay floats (quantized ones need a texture transform that our materials do not have)
    run(GLTFPACK, '-i', f'{src}/room.glb', '-o', f'{dst}/room.glb', '-cc', '-kn', '-ke', '-km', '-kv', '-vp', '16', '-vtf', '-vn', '10', '-vc', '12')
    shutil.copy(f'{src}/scene.json', f'{dst}/scene.json'); shutil.rmtree(tmp)
    size = lambda d: sum(os.path.getsize(os.path.join(p, f)) for p, _, fs in os.walk(d) for f in fs) / 1e6
    print('%-11s %5.1f MB -> %5.1f MB   (%d files -> %d)' % (room, size(src), size(dst), sum(len(f) for *_, f in os.walk(src)), sum(len(f) for *_, f in os.walk(dst))), flush=True)

for room in sys.argv[1:] or sorted(os.listdir(f'{ROOT}/assets-src')): pack(room)
