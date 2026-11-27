# Path tracing of room light into linear HDR atlases
import bpy, bmesh, sys, os, math, json, time
import numpy as np
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
SCALE = float(a[0]) if a else 0.25
SPP = int(a[1]) if len(a) > 1 else 32
ONLY = a[2].split(',') if len(a) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
s = bpy.context.scene
ROOM = s['lobby'].get('room', 'lobby')
OUTD = os.path.join(HERE, '..', 'assets-src', ROOM); os.makedirs(os.path.join(OUTD, 'tex'), exist_ok=True)
HAS_CHAND = 'chand' in s['lobby'].keys()
RES = {'floorN': 2048, 'floorF': 2048, 'center': 4096, 'archL': 4096, 'archR': 4096, 'archC': 4096, 'props': 4096, 'people': 4096, 'back': 1024, 'chandA': 1024, 'chandB': 1024}
RES['folio'] = 2048
RES['polish'] = 2048
RES['foliage'] = 2048
FULL = {'foliage'}
layer_res = lambda key, cap: RES[key] if key in FULL else min(RES[key], cap)
LAYER_RES = 1024
FINISH_RES = lambda key: RES[key] if key in FULL else max(256, min(1024, RES[key] // 4))
AO_DISTANCE = 1.0
PHASES = [0.0, 120.0, 240.0]
PASSES = os.environ.get('LOBBY_PASSES', 'base,chand,layers,sky,albedo,finish').split(',')
SPIN = s['lobby'].to_dict().get('spin')
SKY_PHASES = 6; SKY_RES = 512; ALB_RES = 2048

s = bpy.context.scene
p = bpy.context.preferences.addons['cycles'].preferences
DEV = os.environ.get('LOBBY_DEVICE', 'CUDA')
p.compute_device_type = DEV; p.get_devices()
for d in p.devices: d.use = (d.type == DEV)
print('DEVICES', [(d.name, d.type) for d in p.devices if d.use], flush=True)
s.cycles.device = 'GPU'
s.cycles.samples = SPP
s.cycles.use_adaptive_sampling = True; s.cycles.adaptive_threshold = 0.015
s.cycles.use_denoising = True; s.cycles.denoiser = 'OPENIMAGEDENOISE'
s.cycles.sample_clamp_indirect = 12
s.cycles.max_bounces = 8
s.render.bake.view_from = 'ABOVE_SURFACE'
s.render.bake.margin = max(2, int(10 * SCALE)); s.render.bake.margin_type = 'EXTEND'
s.render.bake.use_clear = True

HDR_RANGE = 8.0
def pixels(img):
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32); img.pixels.foreach_get(px)
    return np.nan_to_num(px.reshape(-1, 4), nan=0.0, posinf=HDR_RANGE)
def save_encoded(px, w, h, path, rng=HDR_RANGE):
    buf = np.ones((w * h, 4), np.float32)
    buf[:, :3] = np.sqrt(np.clip(px[:, :3], 0.0, rng) / rng)
    out = bpy.data.images.new('enc', w, h, alpha=False, float_buffer=False)
    out.colorspace_settings.name = 'Non-Color'
    out.pixels.foreach_set(buf.ravel())
    out.filepath_raw = path; out.file_format = 'WEBP'; out.save(quality=94)
    bpy.data.images.remove(out)
def save_data(rgba, w, h, path):
    out = bpy.data.images.new('data', w, h, alpha=True, float_buffer=False)
    out.colorspace_settings.name = 'Non-Color'; out.alpha_mode = 'CHANNEL_PACKED'
    out.pixels.foreach_set(np.clip(rgba, 0.0, 1.0).astype(np.float32).ravel())
    out.filepath_raw = path; out.file_format = 'WEBP'; out.save(quality=100)
    bpy.data.images.remove(out)

vl = bpy.context.view_layer
def activate(ob):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); vl.objects.active = ob

dg = bpy.context.evaluated_depsgraph_get()
meshes = [o for o in s.objects if o.type == 'MESH' and ('grp' in o or 'em' in o)]
for o in meshes:
    if o.modifiers:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear(); o.data = me
    if 'grp' in o:
        o.data.set_sharp_from_angle(angle=math.radians(38))

def join(objs, name):
    activate(objs[0])
    for o in objs: o.select_set(True)
    if len(objs) > 1: bpy.ops.object.join()
    ob = vl.objects.active; ob.name = name; ob.data.name = name
    return ob
EM_RANGE = 32.0
def display_radiance(key):
    c, k = s['lobby']['em'][key]['color'], min(s['lobby']['em'][key]['strength'], EM_RANGE)
    return [c[0] * k, c[1] * k, c[2] * k]
polished = {'chrome', 't_chrome', 'brass', 'gilt', 'copper', 'foil', 'solar', 't_glass',
            'glasstop', 'greenlamp', 'glassware', 'whisky', 'projection_optic'}
byg, bye = {}, {}
for o in meshes:
    if 'grp' in o:
        group = o['grp']; m = o.data.materials[0] if len(o.data.materials) == 1 else None
        if m and m.name.rsplit('.', 1)[0] in polished and not group.startswith('chand'):
            group = 'polish'; o['grp'] = group
        elif m and m.name.rsplit('.', 1)[0] == 'leaf':
            group = 'foliage'; o['grp'] = group
        byg.setdefault(group, []).append(o)
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
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=(11.0 if len(me.polygons) < 6000 else 2.5) / res, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode='OBJECT')

def principled(m):
    if m and m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED': return n
def reflectance(m):
    b = principled(m)
    if b is None: return (0.04, 0.04, 0.04, 0.0), (0.05, 0.0)
    I = b.inputs; ior = I['IOR'].default_value; metal = I['Metallic'].default_value
    f0d = min(1.0, ((ior - 1) / (ior + 1)) ** 2 * 2 * I['Specular IOR Level'].default_value)
    f0 = [(1 - metal) * f0d * t + metal * c for t, c in zip(I['Specular Tint'].default_value[:3], I['Base Color'].default_value[:3])]
    return (*f0, I['Coat Weight'].default_value), (I['Coat Roughness'].default_value, I['Sheen Weight'].default_value)
def paint_finish(ob):
    me = ob.data; n = len(me.loops)
    mi = np.zeros(len(me.polygons), np.int32); me.polygons.foreach_get('material_index', mi)
    lt = np.zeros(len(me.polygons), np.int32); me.polygons.foreach_get('loop_total', lt)
    ls = np.zeros(len(me.polygons), np.int32); me.polygons.foreach_get('loop_start', ls)
    if len(ls) and not np.array_equal(ls, np.concatenate(([0], np.cumsum(lt)[:-1]))): raise RuntimeError(f'{ob.name}: loops not in face order')
    per_loop = np.repeat(mi, lt); spec = np.zeros((n, 4), np.float32); coat = np.zeros((n, 2), np.float32)
    for k, slot in enumerate(me.materials):
        a, c = reflectance(slot); sel = per_loop == k; spec[sel] = a; coat[sel] = c
    for a in [a for a in me.color_attributes]: me.color_attributes.remove(a)
    ca = me.color_attributes.new('Specular', 'FLOAT_COLOR', 'CORNER'); ca.data.foreach_set('color', spec.ravel())
    me.color_attributes.active_color = ca; me.color_attributes.render_color_index = 0
    uv = me.uv_layers.new(name='Coat'); uv.data.foreach_set('uv', coat.ravel())
    me.uv_layers.active = me.uv_layers['UVMap']; me.uv_layers['UVMap'].active_render = True
for ob in groups.values(): paint_finish(ob)

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
def sky_light(on):
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
    s.render.bake.margin = margin
    if kind in ('DIFFUSE', 'COMBINED'):
        pf = {'COLOR'} if kind == 'DIFFUSE' else {'INDIRECT', 'DIFFUSE'} | ({'DIRECT', 'EMIT'} if direct else set())
        bpy.ops.object.bake(type=kind, pass_filter=pf, margin=margin)
    else: bpy.ops.object.bake(type=kind, margin=margin)
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
if 'chand' in PASSES and HAS_CHAND:
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
            bake(key, groups[key], max(128, int(layer_res(key, LAYER_RES) * SCALE)), '%s_c%d' % (key, i), 3)
    for o, rest, sg in movers: o.matrix_world = rest
    vl.update()
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
            t = time.time(); res = max(128, int(layer_res(key, SKY_RES) * SCALE))
            sun_light(False); sky_light(True); px = bake_px(key, groups[key], res, 3)
            sun_light(True); sky_light(False); px += bake_px(key, groups[key], res, 3, direct=False)
            save_encoded(px, res, res, os.path.join(OUTD, 'tex', '%s_s%d.webp' % (key, i)))
            print('BAKED %s_s%d %dpx in %.0fs' % (key, i, res, time.time() - t), flush=True)
    for o, rest in room: o.matrix_world = rest
    vl.update()
if 'albedo' in PASSES and SPIN:
    for key in static:
        if ONLY and key not in ONLY: continue
        res = max(128, int(min(RES[key] // 2, ALB_RES) * SCALE))
        save_encoded(bake_px(key, groups[key], res, max(2, int(6 * SCALE)), kind='DIFFUSE'), res, res, os.path.join(OUTD, 'tex', key + '_a.webp'), rng=1.0)
        print('BAKED %s_a %dpx' % (key, res), flush=True)

def reflectance_emission(on, saved=[]):
    if not on:
        for m, nodes, colour, strength, links in saved:
            for n in nodes: m.node_tree.nodes.remove(n)
            b = principled(m); b.inputs['Emission Color'].default_value = colour; b.inputs['Emission Strength'].default_value = strength
            for socket, src in links: m.node_tree.links.new(src, b.inputs[socket])
        saved.clear(); return
    for m in bpy.data.materials:
        b = principled(m)
        if b is None: continue
        I, nt = b.inputs, m.node_tree
        links = [(k, l.from_socket) for k in ('Emission Color', 'Emission Strength') for l in I[k].links]
        saved.append((m, [], tuple(I['Emission Color'].default_value), I['Emission Strength'].default_value, links))
        for k in ('Emission Color', 'Emission Strength'):
            for l in list(I[k].links): nt.links.remove(l)
        I['Emission Strength'].default_value = 1.0; I['Emission Color'].default_value = (1, 1, 1, 1)
        metal = I['Metallic'].default_value; f0 = reflectance(m)[0][:3]
        if metal > 0 and I['Base Color'].is_linked:
            lum = max(1e-4, 0.2126 * f0[0] + 0.7152 * f0[1] + 0.0722 * f0[2])
            f0d = min(1.0, ((I['IOR'].default_value - 1) / (I['IOR'].default_value + 1)) ** 2 * 2 * I['Specular IOR Level'].default_value)
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs[0].default_value = metal
            mix.inputs[6].default_value = (f0d, f0d, f0d, 1); nt.links.new(I['Base Color'].links[0].from_socket, mix.inputs[7])
            sc = nt.nodes.new('ShaderNodeVectorMath'); sc.operation = 'SCALE'; sc.inputs['Scale'].default_value = 1.0 / lum
            nt.links.new(mix.outputs[2], sc.inputs[0]); nt.links.new(sc.outputs['Vector'], I['Emission Color']); saved[-1][1].extend((mix, sc))
FINISHED = []
if 'finish' in PASSES:
    s.world.light_settings.distance = AO_DISTANCE
    for key in groups:
        if key.startswith('floor') or (ONLY and key not in ONLY): continue
        ob, res = groups[key], max(64, int(FINISH_RES(key) * SCALE)); t = time.time(); m = max(2, int(4 * SCALE))
        rough = bake_px(key, ob, res, m, kind='ROUGHNESS')[:, 0]
        ao = bake_px(key, ob, res, m, kind='AO')[:, 0]
        chand_light(False); sky_light(False); sun_light(False)
        for mat_ in EM_ALL: emis(mat_).default_value = 0.0
        for l, e in LAMPS.items(): l.energy = e if l.type != 'SUN' else 0.0
        lamps = bake_px(key, ob, res, m, kind='SHADOW')[:, 0] if any(l.type != 'SUN' and e > 0 for l, e in LAMPS.items()) else np.ones(res * res, np.float32)
        reflectance_emission(True); rgb = bake_px(key, ob, res, m, kind='EMIT'); reflectance_emission(False)
        scale = (0.2126 * rgb[:, 0] + 0.7152 * rgb[:, 1] + 0.0722 * rgb[:, 2]) / 2
        chand_light(True); other_light(True)
        save_data(np.stack([rough, ao, lamps, scale], 1), res, res, os.path.join(OUTD, 'tex', key + '_f.webp')); FINISHED.append(key)
        print('BAKED %s_f %dpx in %.0fs (roughness %.2f..%.2f, occlusion %.2f, lamps %.2f, reflectance %.2f..%.2f)' % (
            key, res, time.time() - t, rough.min(), rough.max(), ao.mean(), lamps.mean(), 2 * scale.min(), 2 * scale.max()), flush=True)
chand_light(True); other_light(True)
LIGHTS = []
for o in s.objects:
    if o.type != 'LIGHT' or o.data.type == 'SUN' or o.hide_render or not o.visible_glossy: continue
    l = o.data
    if l.type not in ('POINT', 'SPOT'): print('WARNING: no live highlight for', l.type, o.name); continue
    item = {'name': o.name, 'pos': list(o.matrix_world.translation), 'radius': l.shadow_soft_size, 'intensity': [l.energy * c / (4 * math.pi) for c in l.color]}
    if l.type == 'SPOT':
        d = (o.matrix_world.to_3x3() @ Vector((0, 0, -1))).normalized(); ca = math.cos(l.spot_size / 2)
        item.update(dir=list(d), cos=ca, smooth=(1 - ca) * l.spot_blend)
    LIGHTS.append(item)

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
                          export_normals=True, export_texcoords=True, export_materials='EXPORT', export_image_format='NONE',
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
                          export_extras=True, export_apply=False, export_animations=False, export_cameras=False, export_lights=False)
info = s['lobby'].to_dict()
info['room'] = ROOM; info['v'] = int(time.time()); info['groups'] = list(groups.keys()); info['hdr_range'] = HDR_RANGE; info['em_range'] = EM_RANGE
info.pop('probe', None)
info['finish'] = {'groups': FINISHED, 'view': 'above surface', 'glossy': 'live', 'ao_distance': AO_DISTANCE}
info['lights'] = LIGHTS
if SPIN: info['spin'] = dict(SPIN, phases=SKY_PHASES, layered=static)
if HAS_CHAND: info['chand'] = dict(info.get('chand', {}), phases=PHASES, layered=static, spin=dict(chandA=1, chandB=-1))
json.dump(info, open(os.path.join(OUTD, 'scene.json'), 'w'), indent=1)
print('EXPORTED', os.path.getsize(os.path.join(OUTD, 'room.glb')) // 1024, 'KB')
