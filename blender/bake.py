"""
Path-trace lighting (+ reflections as seen from the hero camera) into linear-HDR texture atlases, then export for three.js.
The floor is baked WITHOUT its glossy lobe: its reflection is rendered live in three.js (planar reflection).
  ./run.sh -b lobby.blend --python bake.py -- <scale> <spp> [group,group,...]
scale: 1.0 = final (4k atlases), 0.25 = quick preview.
Outputs ../assets-src/<room>/{room.glb, scene.json, tex/<group>.webp}; tools/pack.py turns that into what the site serves.
"""
import bpy, bmesh, sys, os, math, json, time
import numpy as np
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
SCALE = float(a[0]) if a else 0.25
SPP = int(a[1]) if len(a) > 1 else 32
ONLY = a[2].split(',') if len(a) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
s = bpy.context.scene
ROOM = s['lobby'].get('room', 'lobby')                 # each room bakes into its own asset folder
OUTD = os.path.join(HERE, '..', 'assets-src', ROOM); os.makedirs(os.path.join(OUTD, 'tex'), exist_ok=True)
HAS_CHAND = 'chand' in s['lobby'].keys()
RES = {'floorN': 2048, 'floorF': 2048, 'center': 4096, 'archL': 4096, 'archR': 4096, 'archC': 4096, 'props': 4096, 'people': 4096, 'back': 1024, 'chandA': 1024, 'chandB': 1024}
LAYER_RES = 1024                      # the chandelier's light is low-frequency: small maps are enough
PHASES = [0.0, 120.0, 240.0]          # rotation phases at which its light is baked (blended at runtime)
PASSES = os.environ.get('LOBBY_PASSES', 'base,chand,layers,sky,albedo').split(',')
SPIN = s['lobby'].to_dict().get('spin')    # the room turns under the sky: see pass 'sky' below
SKY_PHASES = 6; SKY_RES = 512; ALB_RES = 2048

s = bpy.context.scene
p = bpy.context.preferences.addons['cycles'].preferences
DEV = os.environ.get('LOBBY_DEVICE', 'CUDA')          # 'OPTIX' on RTX cards
p.compute_device_type = DEV; p.get_devices()
for d in p.devices: d.use = (d.type == DEV)
print('DEVICES', [(d.name, d.type) for d in p.devices if d.use], flush=True)
s.cycles.device = 'GPU'
s.cycles.samples = SPP
s.cycles.use_adaptive_sampling = True; s.cycles.adaptive_threshold = 0.015
s.cycles.use_denoising = True; s.cycles.denoiser = 'OPENIMAGEDENOISE'
s.cycles.sample_clamp_indirect = 12
s.cycles.max_bounces = 8
s.render.bake.view_from = 'ACTIVE_CAMERA'     # reflections are traced as seen from the hero camera
s.render.bake.margin = max(2, int(10 * SCALE)); s.render.bake.margin_type = 'EXTEND'
s.render.bake.use_clear = True

HDR_RANGE = 8.0
def pixels(img):
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32); img.pixels.foreach_get(px)
    return np.nan_to_num(px.reshape(-1, 4), nan=0.0, posinf=HDR_RANGE)
def save_encoded(px, w, h, path, rng=HDR_RANGE):
    """Scene-linear radiance -> 8 bit: stored = sqrt(L / range). Decoded in the three.js shaders, tone mapped there."""
    buf = np.ones((w * h, 4), np.float32)
    buf[:, :3] = np.sqrt(np.clip(px[:, :3], 0.0, rng) / rng)
    out = bpy.data.images.new('enc', w, h, alpha=False, float_buffer=False)
    out.colorspace_settings.name = 'Non-Color'
    out.pixels.foreach_set(buf.ravel())
    out.filepath_raw = path; out.file_format = 'WEBP'; out.save(quality=94)
    bpy.data.images.remove(out)

vl = bpy.context.view_layer
def activate(ob):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); vl.objects.active = ob

# ---- 1. apply modifiers, smooth shading with sharp edges
dg = bpy.context.evaluated_depsgraph_get()
meshes = [o for o in s.objects if o.type == 'MESH' and ('grp' in o or 'em' in o)]
for o in meshes:
    if o.modifiers:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear(); o.data = me
    if 'grp' in o:
        for pl in o.data.polygons: pl.use_smooth = True
        o.data.set_sharp_from_angle(angle=math.radians(38))

# ---- 2. join per bake group / per emissive colour
def join(objs, name):
    activate(objs[0])
    for o in objs: o.select_set(True)
    if len(objs) > 1: bpy.ops.object.join()
    ob = vl.objects.active; ob.name = name; ob.data.name = name
    return ob
# Light strips: everything that does not move becomes ONE mesh, with the radiance to display stored per vertex
# (one draw call instead of one per colour). The chandelier's lamps stay separate because they turn.
EM_RANGE = 8.0
import re
def display_radiance(key):
    c, k = s['lobby']['em'][key]['color'], s['lobby']['em'][key]['strength']
    k = min(k, 7.0)                                   # shown value; some lamps are baked far brighter than display white
    if re.match(r'(ice|white)\d', key): k *= 0.6      # roof strips sit behind diffusers, so the ceiling stays quiet
    if key in ('step', 'stair'): k *= 0.5             # hidden wash lights: only ever seen in the floor's reflection
    return [c[0] * k, c[1] * k, c[2] * k]
byg, bye = {}, {}
for o in meshes:
    if 'grp' in o: byg.setdefault(o['grp'], []).append(o)
    else:
        key = o['em']; moving = key.startswith('chand')
        if not moving:
            rgb = [v / EM_RANGE for v in display_radiance(key)]
            ca = o.data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
            ca.data.foreach_set('color', np.tile(np.array(rgb + [1.0], np.float32), len(o.data.loops)))
            o.data.color_attributes.active_color = ca; o.data.color_attributes.render_color_index = 0
            o['em'] = 'static'
        bye.setdefault(key if moving else 'static', []).append(o)
groups = {k: join(v, k) for k, v in sorted(byg.items())}
ems = {k: join(v, 'EM_' + k) for k, v in sorted(bye.items())}
print('GROUPS', {k: len(v.data.polygons) for k, v in groups.items()}, 'EM', {k: len(v.data.polygons) for k, v in ems.items()})

# ---- 3. lightmap UVs
for key, ob in groups.items():
    res = int(RES[key] * SCALE)
    me = ob.data
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name='UVMap')
    if key.startswith('floor'):
        xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys); pad = 2.0 / res
        uv = me.uv_layers.active.data
        for l in me.loops:
            c = me.vertices[l.vertex_index].co
            uv[l.index].uv = (pad + (1 - 2 * pad) * (c.x - x0) / (x1 - x0), pad + (1 - 2 * pad) * (c.y - y0) / (y1 - y0))
    else:
        activate(ob)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=11.0 / res, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode='OBJECT')

# ---- 4. bake
# Light is additive, so the turning chandelier is handled by splitting the lighting:
#   base   = everything except the chandelier's lamps                         (full resolution)
#   layers = only the chandelier's lamps, with the rings at each rotation phase (small maps)
# three.js then shows base + a trigonometric blend of the layers for the current rotation angle.
for m in bpy.data.materials:
    if m.node_tree:
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.name = 'BAKE'; m.node_tree.nodes.active = n

def emis(m):
    b = m.node_tree.nodes.get('Principled BSDF') if m.node_tree else None
    return b.inputs['Emission Strength'] if b else None
EM_ALL = {m: emis(m).default_value for m in bpy.data.materials if emis(m) is not None}
CH_MATS = [m for m in EM_ALL if m.name.startswith('EM_chand')]
LAMPS = {l: l.energy for l in bpy.data.lights}
BG = [n for n in s.world.node_tree.nodes if n.type == 'BACKGROUND']
BG0 = [n.inputs['Strength'].default_value for n in BG]
def chand_light(on):
    for m in CH_MATS: emis(m).default_value = EM_ALL[m] if on else 0.0
def inside_light(on):
    for m, v in EM_ALL.items():
        if m not in CH_MATS: emis(m).default_value = v if on else 0.0
    for l, e in LAMPS.items():
        if l.type != 'SUN': l.energy = e if on else 0.0
def sun_light(on):
    for l, e in LAMPS.items():
        if l.type == 'SUN': l.energy = e if on else 0.0
def sky_light(on):                                  # Earth, Moon, stars
    for n, v in zip(BG, BG0): n.inputs['Strength'].default_value = v if on else 0.0
    if 'Outside' in bpy.data.collections: bpy.data.collections['Outside'].hide_render = not on
def other_light(on, outside=None):
    outside = on if outside is None else outside
    inside_light(on); sun_light(outside); sky_light(outside)

def bake_px(key, ob, res, margin, kind='COMBINED', direct=True):
    img = bpy.data.images.new('bake_tmp', res, res, float_buffer=True, alpha=False)
    for m in bpy.data.materials:
        if m.node_tree and 'BAKE' in m.node_tree.nodes: m.node_tree.nodes['BAKE'].image = img
    activate(ob)
    if kind == 'DIFFUSE': pf = {'COLOR'}
    else:
        pf = {'INDIRECT', 'DIFFUSE', 'TRANSMISSION'} | ({'DIRECT', 'EMIT'} if direct else set())
        if not key.startswith('floor'): pf.add('GLOSSY')        # the floor's reflection is rendered live instead
    s.render.bake.margin = margin
    bpy.ops.object.bake(type=kind, pass_filter=pf, margin=margin)
    px = pixels(img); bpy.data.images.remove(img)
    return px
def bake(key, ob, res, name, margin):
    t = time.time()
    save_encoded(bake_px(key, ob, res, margin), res, res, os.path.join(OUTD, 'tex', name + '.webp'))
    print('BAKED %s %dpx in %.0fs' % (name, res, time.time() - t), flush=True)

is_chand = lambda k: k.startswith('chand')
static = [k for k in groups if not is_chand(k)]
if 'base' in PASSES:
    chand_light(False); other_light(True, outside=not SPIN)
    for key in static:
        if ONLY and key not in ONLY: continue
        bake(key, groups[key], int(RES[key] * SCALE), key, max(2, int(10 * SCALE)))
if 'chand' in PASSES and HAS_CHAND:                                       # the rings themselves: lit by everything, in their rest pose
    chand_light(True); other_light(True, outside=not SPIN)
    for key in groups:
        if is_chand(key): bake(key, groups[key], int(RES[key] * SCALE), key, 4)
if 'layers' in PASSES and HAS_CHAND:
    chand_light(True); other_light(False)
    piv = Vector((s['lobby']['chand']['pivot'][0], s['lobby']['chand']['pivot'][1], 0.0))
    spin = {'chandA': 1.0, 'chandB': -1.0}
    movers = [(o, o.matrix_world.copy(), spin[k]) for k in spin for o in (groups.get(k), ems.get(k)) if o]
    from mathutils import Matrix
    for i, ph in enumerate(PHASES):
        for o, rest, sg in movers:
            o.matrix_world = Matrix.Translation(piv) @ Matrix.Rotation(math.radians(ph * sg), 4, 'Z') @ Matrix.Translation(-piv) @ rest
        vl.update()
        for key in static:
            if ONLY and key not in ONLY: continue
            bake(key, groups[key], max(128, int(min(RES[key], LAYER_RES) * SCALE)), '%s_c%d' % (key, i), 3)
    for o, rest, sg in movers: o.matrix_world = rest
    vl.update()
# A spinning room. Seen from inside, the sky turns about the spin axis; for the bake it is simpler to turn the room
# under a fixed sky. Light from outside is baked at SKY_PHASES angles and cross-faded at runtime:
#   Earth, Moon and stars: direct + bounced.   Sun: bounced only; its direct light and shadows are drawn live.
if 'sky' in PASSES and SPIN:
    from mathutils import Matrix
    chand_light(False); inside_light(False)
    piv, ax = Vector(s['lobby']['portal']), Vector(SPIN['axis'])
    out = set(bpy.data.collections['Outside'].all_objects) if 'Outside' in bpy.data.collections else set()
    room = [(o, o.matrix_world.copy()) for o in s.objects if o not in out and o.parent is None and not (o.type == 'LIGHT' and o.data.type == 'SUN')]
    for i in range(SKY_PHASES):
        M = Matrix.Translation(piv) @ Matrix.Rotation(-2 * math.pi * i / SKY_PHASES, 4, ax) @ Matrix.Translation(-piv)
        for o, rest in room: o.matrix_world = M @ rest
        vl.update()
        for key in static:
            if ONLY and key not in ONLY: continue
            t = time.time(); res = max(128, int(min(RES[key], SKY_RES) * SCALE))
            sun_light(False); sky_light(True); px = bake_px(key, groups[key], res, 3)
            sun_light(True); sky_light(False); px += bake_px(key, groups[key], res, 3, direct=False)
            save_encoded(px, res, res, os.path.join(OUTD, 'tex', '%s_s%d.webp' % (key, i)))
            print('BAKED %s_s%d %dpx in %.0fs' % (key, i, res, time.time() - t), flush=True)
    for o, rest in room: o.matrix_world = rest
    vl.update()
# what the live sunlight needs: each surface's diffuse colour
if 'albedo' in PASSES and SPIN:
    for key in static:
        if ONLY and key not in ONLY: continue
        res = max(128, int(min(RES[key] // 2, ALB_RES) * SCALE))
        save_encoded(bake_px(key, groups[key], res, max(2, int(6 * SCALE)), kind='DIFFUSE'), res, res, os.path.join(OUTD, 'tex', key + '_a.webp'), rng=1.0)
        print('BAKED %s_a %dpx' % (key, res), flush=True)
chand_light(True); other_light(True)

# ---- 5. export geometry (no textures inside; three.js pairs meshes with atlases by name)
ph = {}
for key, ob in groups.items():
    m = bpy.data.materials.new('BAKE_' + key); ob.data.materials.clear(); ob.data.materials.append(m)
    for pl in ob.data.polygons: pl.material_index = 0
for key, ob in ems.items():
    while ob.data.uv_layers: ob.data.uv_layers.remove(ob.data.uv_layers[0])
bpy.ops.object.select_all(action='DESELECT')
for ob in list(groups.values()) + list(ems.values()) + [o for o in s.objects if 'fx' in o]:
    ob.hide_render = False; ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUTD, 'room.glb'), export_format='GLB', use_selection=True, export_yup=True,
                          export_normals=bool(SPIN), export_texcoords=True, export_materials='EXPORT', export_image_format='NONE',
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
                          export_extras=True, export_apply=False, export_animations=False, export_cameras=False, export_lights=False)
info = s['lobby'].to_dict()
info['room'] = ROOM; info['v'] = int(time.time()); info['groups'] = list(groups.keys()); info['hdr_range'] = HDR_RANGE; info['em_range'] = EM_RANGE
if SPIN: info['spin'] = dict(SPIN, phases=SKY_PHASES, layered=static)
if HAS_CHAND: info['chand'] = dict(info.get('chand', {}), phases=PHASES, layered=static, spin=dict(chandA=1, chandB=-1))
json.dump(info, open(os.path.join(OUTD, 'scene.json'), 'w'), indent=1)
print('EXPORTED', os.path.getsize(os.path.join(OUTD, 'room.glb')) // 1024, 'KB')
