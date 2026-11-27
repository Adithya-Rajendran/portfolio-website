# Projects room, Fabrication Bay 02
import os
_here = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(_here, 'build_scene.py')).read().split('_SHARED_KIT_END = True')[0], globals())

random.seed(11)
WD = 8.0
Y0, Y1 = -7.0, 25.0
H = 8.6
CAM_POS = Vector((0, -4.6, 1.7)); CAM_TGT = Vector((0, 12, 2.9))
CLOSE_POS = Vector((2.3, 11.6, 1.75)); CLOSE_TGT = Vector((0, 19.0, 3.3))
PAD = Vector((0, 19.0, 0))
FRAMES = [-5.0, -1.0, 3.0, 7.0, 11.0, 15.0, 19.0, 23.0]
FLOOR_ROUGH = (0.2, 0.24); FLOOR_IOR = 1.5

mat('steel', (0.15, 0.16, 0.18), 0.45, 0.6, var=0.12)
mat('panel', (0.3, 0.31, 0.33), 0.55, var=0.08, seams=(0, 2.5, 2.15))
mat('roof', (0.13, 0.135, 0.14), 0.6, var=0.08, seams=(3.0, 2.5, 0))
mat('yellow', (0.8, 0.5, 0.03), 0.45, 0.0, 1.5, 0.3, var=0.1)
mat('concrete', (0.2, 0.2, 0.2), 0.6, var=0.1, seams=(2.0, 2.0, 0))
mat('foil', (0.95, 0.62, 0.18), 0.32, 1.0, var=0.14)
mat('solar', (0.02, 0.05, 0.17), 0.14, 0.0, 1.6, 1.0)
mat('rubber', (0.02, 0.02, 0.022), 0.7)
mat('hazard_y', (0.85, 0.6, 0.02), 0.5)
mat('hazard_k', (0.02, 0.02, 0.02), 0.5)
EM.update({'work': ((1.0, 0.84, 0.66), 9.0), 'cool': ((0.5, 0.82, 1.0), 2.2), 'seam': ((0.55, 0.9, 1.0), 5.0), 'core': ((0.1, 0.8, 1.0), 6.0), 'beacon': ((1.0, 0.42, 0.05), 6.0)})
for k in ('work', 'cool', 'seam', 'core', 'beacon'):
    mat('EM_' + k, (0, 0, 0), 0.5, emis=EM[k][0], estr=EM[k][1])

def rbox(name, size, M, m, grp, bevel=0.0, **kw):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
    return finish(name, bm, m, grp, bevel=bevel, M=M, **kw)
def beam(name, p0, p1, t, y0, y1, m, grp):
    a, b = Vector(p0), Vector(p1); n = (b - a).normalized(); o = Vector((-n.y, n.x)) * t / 2
    return prism(name, [tuple(a + o), tuple(b + o), tuple(b - o), tuple(a - o)], 'Y', y0, y1, m, grp)
def spot(name, loc, target, watts, size=42, color=(1.0, 0.86, 0.7), blend=0.35, radius=0.08):
    l = bpy.data.lights.new(name, 'SPOT'); l.energy = watts; l.spot_size = math.radians(size); l.spot_blend = blend; l.color = color; l.shadow_soft_size = radius
    o = bpy.data.objects.new(name, l); COL.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    Mc = Matrix.Translation(loc) @ o.rotation_euler.to_matrix().to_4x4()
    lathe(name + '_can', [(0.0, 0.3), (0.12, 0.3), (0.16, 0.02), (0.16, -0.02), (0.13, -0.02), (0.13, 0.26), (0, 0.26)], 'dark', 'archC', segs=20, closed=False, M=Mc)
    lathe(name + '_lens', [(0, 0.03), (0.125, 0.03), (0.125, 0.04), (0, 0.04)], em='work', segs=16, closed=False, M=Mc)
    return o

exec(open(os.path.join(_here, 'assets_tech.py')).read(), globals())
exec(open(os.path.join(_here, 'assets_exhibits.py')).read(), globals())
bench({**TECH, **EXHIBIT_ASSETS})

quad('floor_near', [(-WD, Y0, 0), (WD, Y0, 0), (WD, 9, 0), (-WD, 9, 0)], 'floor', 'floorN')
quad('floor_far', [(-WD, 9, 0), (WD, 9, 0), (WD, Y1, 0), (-WD, Y1, 0)], 'floor', 'floorF')
quad('ceiling', [(-WD, Y0, H), (WD, Y0, H), (WD, Y1, H), (-WD, Y1, H)], 'roof', 'archC')
quad('backwall', [(-WD, Y0, 0), (WD, Y0, 0), (WD, Y0, H), (-WD, Y0, H)], 'panel', 'back')
box('backlum', -3.0, 3.0, Y0, Y0 + 0.05, 5.6, 6.2, 'lum_cool', 'back')
for s in (1, -1):
    g = 'archR' if s > 0 else 'archL'; sx = lambda x: s * x
    quad(f'wall_{g}', [(sx(WD), Y0, 0), (sx(WD), Y1, 0), (sx(WD), Y1, H), (sx(WD), Y0, H)], 'panel', g)
    box(f'base_{g}', sx(7.82), sx(WD), Y0, Y1, 0, 0.5, 'concrete', g, bevel=0.02)
    box(f'dado_{g}', sx(7.9), sx(WD), Y0, Y1, 1.05, 1.13, 'steel', g)
    box(f'tray_{g}', sx(7.45), sx(7.95), Y0, Y1, 5.15, 5.2, 'steel', g)
    box(f'traylip_{g}', sx(7.45), sx(7.47), Y0, Y1, 5.2, 5.3, 'steel', g)
    for i, (dx, r, m) in enumerate(((7.58, 0.035, 'rubber'), (7.68, 0.03, 'rubber'), (7.8, 0.045, 'brass'))):
        tube(f'cable_{g}{i}', sx(dx), 5.2 + r, r, Y0, Y1, m, g, n=8)
    tube(f'pipe_{g}', sx(7.75), 6.1, 0.09, Y0, Y1, 'wall2', g)
    box(f'wash_{g}', sx(7.8), sx(7.86), Y0, Y1, 0.5, 0.52, em='cool')
    for k, fy in enumerate(FRAMES):
        gg = 'back' if fy < CAM_POS.y else g
        box(f'col_{g}{k}', sx(7.35), sx(7.75), fy - 0.16, fy + 0.16, 0, H - 0.25, 'steel', gg, bevel=0.012)
        box(f'colflange_{g}{k}', sx(7.3), sx(7.36), fy - 0.24, fy + 0.24, 0, H - 0.25, 'steel', gg)
        box(f'colfoot_{g}{k}', sx(7.15), sx(7.8), fy - 0.34, fy + 0.34, 0, 0.06, 'steel', gg, bevel=0.01)
        beam(f'haunch_{g}{k}', (sx(7.35), 5.6), (sx(5.9), H - 1.5), 0.2, fy - 0.1, fy + 0.1, 'steel', gg)
        beam(f'top_{g}{k}', (sx(7.5), H - 0.38), (0, H - 0.38), 0.24, fy - 0.14, fy + 0.14, 'steel', 'archC')
        beam(f'bot_{g}{k}', (sx(7.35), H - 1.5), (0, H - 1.5), 0.2, fy - 0.12, fy + 0.12, 'steel', 'archC')
        xs = [7.35, 5.9, 4.4, 2.95, 1.5, 0.0]
        for i in range(5):
            a, b = (sx(xs[i]), H - 1.5 if i % 2 else H - 0.4), (sx(xs[i + 1]), H - 0.4 if i % 2 else H - 1.5)
            beam(f'web_{g}{k}{i}', a, b, 0.1, fy - 0.06, fy + 0.06, 'steel', 'archC')
        box(f'worklight_{g}{k}', sx(1.4), sx(4.6), fy - 0.07, fy + 0.07, H - 1.66, H - 1.62, em=em_ramp('work', k, fy, 4.0, 11.0, 1.3))
        box(f'worklightbody_{g}{k}', sx(1.3), sx(4.7), fy - 0.1, fy + 0.1, H - 1.62, H - 1.56, 'dark', 'archC')
    box(f'rail_{g}', sx(6.3), sx(6.6), Y0, Y1, 6.0, 6.3, 'yellow', g, bevel=0.015)
    box(f'railcap_{g}', sx(6.38), sx(6.52), Y0, Y1, 6.3, 6.36, 'steel', g)
    for k, fy in enumerate(FRAMES):
        prism(f'corbel_{g}{k}', [(sx(7.35), 6.0), (sx(6.3), 6.0), (sx(6.3), 5.86), (sx(7.35), 5.3)], 'Y', fy - 0.12, fy + 0.12, 'steel', 'back' if fy < CAM_POS.y else g)
    box(f'aisle_{g}', sx(2.36), sx(2.48), Y0, 14.2, 0.0, 0.003, 'hazard_y', 'center')
    for i in range(10):
        y = -6.0 + 2.2 * i
        lathe(f'marker_{g}{i}', [(0, 0.004), (0.04, 0.004), (0.04, 0.0), (0, 0.0)], em=em_ramp('mark', i, y, 0.5, 5.0), segs=12, closed=False, M=T((sx(2.42), y, 0)))

for x in (-6.0, -3.0, 0.0, 3.0, 6.0):
    box('purlin', x - 0.07, x + 0.07, Y0, Y1, H - 0.24, H - 0.02, 'steel', 'archC')

quad('endwall', [(-WD, Y1, 0), (WD, Y1, 0), (WD, Y1, H), (-WD, Y1, H)], 'panel', 'archC')
a_cargo_bulkhead(T((0, Y1, 0)))

BY = PAD.y
hook_anchor = a_gantry(T(PAD))
SAT = Vector((0, BY, 3.1))
for a in range(4):
    ang = pi / 4 + a * pi / 2
    bot = SAT + Vector((0.55 * math.cos(ang), 0.55 * math.sin(ang), 0.92))
    axis = bot - hook_anchor
    q = axis.to_track_quat('Z', 'Y')
    rbox(f'sling{a}', (0.018, 0.018, axis.length), Matrix.Translation((hook_anchor + bot) / 2) @ q.to_matrix().to_4x4(), 'rubber', 'center')
a_satellite(Matrix.Translation(SAT) @ Matrix.Rotation(math.radians(24), 4, 'Z'))
MPD = T(PAD)
lathe('pad', [(0, 0.16), (3.0, 0.16), (3.0, 0.1), (2.86, 0.1), (2.86, 0)], 'plat', 'center', segs=128, closed=False, M=MPD)
lathe('pad_led', [(2.88, 0.085), (2.97, 0.085), (2.97, 0.095), (2.88, 0.095)], em='stair', segs=128, M=MPD)
lathe('pad_ring', [(2.5, 0.16), (2.66, 0.16), (2.66, 0.163), (2.5, 0.163)], 'hazard_y', 'center', segs=128, M=MPD)
lathe('pad_floor_ring', [(3.6, 0.0), (3.7, 0.0), (3.7, 0.003), (3.6, 0.003)], 'hazard_y', 'center', segs=128, M=MPD)
for a in range(3):
    ang = math.radians(200 + a * 70); p = PAD + Vector((2.0 * math.cos(ang), 2.0 * math.sin(ang), 0.16))
    lathe(f'stand{a}', [(0, 1.15), (0.05, 1.15), (0.05, 0.05), (0.3, 0.03), (0.3, 0), (0, 0)], 'steel', 'center', segs=16, closed=False, M=T(p))
    rbox(f'standtop{a}', (0.5, 0.36, 0.03), T(p + Vector((0, 0, 1.16)), (0.5, 0, ang + pi / 2)), 'dark', 'center', bevel=0.008)
spot('key_sat', (3.0, BY - 4.2, 7.0), SAT, 9000, 46)
spot('key_sat2', (-3.4, BY - 3.6, 7.0), SAT, 4500, 46)
spot('rim_sat', (-3.2, BY + 2.6, 7.0), SAT, 6000, 44, color=(0.6, 0.82, 1.0))
spot('pad_fill', (0, BY - 1.0, 7.0), PAD, 1500, 60)
for d in (-1, 1):
    spot(f'door_wash{d}', (d * 3.2, Y1 - 3.2, 7.0), (d * 2.8, Y1 - 0.3, 2.6), 3500, 60, color=(0.75, 0.88, 1.0))

def place_rover(M, _i):
    a_rover(M @ Matrix.Rotation(math.radians(-28 if M.translation.x < 0 else 28), 4, 'Z'))

def place_arm(M, _i):
    a_manipulator(M @ Matrix.Rotation(math.radians(150), 4, 'Z'))

EXHIBITS = [(Vector((-4.6, 2.5, 0)), place_rover), (Vector((4.6, 2.5, 0)), place_arm),
            (Vector((-4.6, 12.5, 0)), a_engine), (Vector((4.6, 12.5, 0)), a_lattice)]
for i, (c, build) in enumerate(EXHIBITS):
    top = a_plinth(T(c), i)
    build(Matrix.Translation(top), i)
    s = 1 if c.x > 0 else -1; g = 'archR' if s > 0 else 'archL'
    spot(f'key{i}', (c.x - s * 1.6, c.y - 1.8, 6.9), top + Vector((0, 0, 0.9)), 4200, 40)
    spot(f'rim{i}', (c.x + s * 1.2, c.y + 2.2, 6.9), top + Vector((0, 0, 0.9)), 1800, 46, color=(0.62, 0.84, 1.0))
    box(f'bezel{i}', s * 7.14, s * 7.24, c.y - 1.55, c.y + 1.55, 1.5, 3.6, 'dark', g, bevel=0.02)
    for dy in (-1.1, 1.1):
        box(f'arm{i}', s * 7.24, s * WD, c.y + dy - 0.04, c.y + dy + 0.04, 2.5, 2.6, 'steel', g)
    quad(f'FX_screen{i}', [(s * 7.133, c.y + s * 1.45, 1.6), (s * 7.133, c.y - s * 1.45, 1.6), (s * 7.133, c.y - s * 1.45, 3.5), (s * 7.133, c.y + s * 1.45, 3.5)], 'lum_screen', fx='screen', uv=True)
    text3d(f'exno{i}', f'0{i + 1}', 0.42, wall_M(s, s * 7.135, c.y + s * 1.2, 3.85), spacing=1.1)

def rack(name, x, y, s, n=4):
    for dy in (-1.0, 1.0):
        for dx in (0.0, 0.55):
            box(name + 'post', s * (7.75 - dx) - 0.025, s * (7.75 - dx) + 0.025, y + dy - 0.025, y + dy + 0.025, 0, 2.6, 'steel', 'props')
    for k in range(n):
        z = 0.25 + k * 0.72
        box(name + 'shelf', s * 7.15, s * 7.8, y - 1.05, y + 1.05, z, z + 0.035, 'steel', 'props')
        yy = y - 0.95
        while yy < y + 0.7:
            w = random.uniform(0.25, 0.55); hh = random.uniform(0.2, 0.5)
            if random.random() < 0.8:
                box(name + 'bin', s * 7.25, s * 7.72, yy, yy + w, z + 0.035, z + 0.035 + hh, random.choice(('crate_w', 'crate_o', 'dark', 'wall2', 'yellow')), 'props', bevel=0.015)
            yy += w + random.uniform(0.04, 0.2)
def bench(name, x0, x1, y):
    box(name + 'top', x0, x1, y - 0.42, y + 0.42, 0.9, 0.96, 'steel', 'props', bevel=0.012)
    for xx in (x0 + 0.08, x1 - 0.08):
        for yy in (y - 0.34, y + 0.34):
            box(name + 'leg', xx - 0.03, xx + 0.03, yy - 0.03, yy + 0.03, 0, 0.9, 'steel', 'props')
    box(name + 'drawer', x0 + 0.15, x0 + 0.85, y - 0.38, y + 0.38, 0.45, 0.88, 'crate_o', 'props', bevel=0.012)
    box(name + 'vise', x1 - 0.5, x1 - 0.25, y - 0.1, y + 0.1, 0.96, 1.12, 'steel', 'props', bevel=0.02)
    lathe(name + 'lamp', [(0, 0.6), (0.012, 0.6), (0.012, 0.02), (0.08, 0.01), (0.08, 0), (0, 0)], 'chrome', 'props', segs=12, closed=False, M=T(((x0 + x1) / 2, y + 0.3, 0.96)))
    lathe(name + 'shade', [(0, 0.1), (0.05, 0.1), (0.11, 0.0), (0.1, 0.0), (0.045, 0.085), (0, 0.085)], 'yellow', 'props', segs=16, closed=False, M=T(((x0 + x1) / 2, y + 0.18, 1.5), (0.5, 0, 0)))
rack('rackL', 0, 5.0, -1); rack('rackR', 0, 5.0, 1); rack('rackL2', 0, 17.0, -1, 3)
pressure_door('door', T((7.8, 9.0, 0), (0, 0, pi)), 'archR', 'ATRIUM', 'RING LINE  ·  STAIR', 'lobby', w=1.6, h=2.4)
bench('benchL', -7.6, -5.6, -3.0); bench('benchR', 5.4, 7.5, 17.0)
for ci, (x, y, z, sz, m) in enumerate(((6.9, -1.9, 0, 0.8, 'crate_w'), (6.95, -1.0, 0, 0.62, 'crate_o'), (6.9, -1.75, 0.8, 0.55, 'crate_o'), (-6.6, 20.6, 0, 0.9, 'crate_w'), (-6.75, 21.6, 0, 0.7, 'crate_w'),
                                       (-6.6, 20.7, 0.9, 0.6, 'crate_o'), (6.4, 21.4, 0, 0.85, 'crate_o'), (6.9, 20.4, 0, 0.6, 'crate_w'))):
    box(f'crate{ci}', x - sz / 2, x + sz / 2, y - sz / 2, y + sz / 2, z, z + sz, m, 'props', bevel=0.025)
    box(f'cratelid{ci}', x - sz / 2 - 0.012, x + sz / 2 + 0.012, y - sz / 2 - 0.012, y + sz / 2 + 0.012, z + sz * 0.44, z + sz * 0.5, 'dark', 'props')
for d in (-1, 1):
    for k in range(3):
        lathe(f'bottle{d}{k}', [(0, 1.5), (0.03, 1.5), (0.04, 1.42), (0.11, 1.3), (0.115, 0.02), (0.1, 0), (0, 0)], ('wall2', 'crate_o', 'white')[k], 'props', segs=20, closed=False, M=T((d * (6.3 + k * 0.27), 24.2, 0)))

a_toolchest(T((-6.95, 6.7, 0))); a_toolchest(T((7.0, 6.9, 0)) @ Matrix.Rotation(pi, 4, 'Z'))
a_cabinet(T((-7.82, 13.5, 0)), rise=3.15); a_cabinet(T((-7.82, 9.6, 0)), rise=3.15); a_cabinet(T((7.82, 13.5, 0)) @ Matrix.Rotation(pi, 4, 'Z'), rise=3.15); a_cabinet(T((7.82, 14.4, 0)) @ Matrix.Rotation(pi, 4, 'Z'), h=1.6, rise=3.55)
for k, fy in enumerate(FRAMES):
    if k % 2: a_extinguisher(T((-7.82, fy + 0.6, 0.5))); a_extinguisher(T((7.82, fy - 0.6, 0.5)) @ Matrix.Rotation(pi, 4, 'Z'))
    for s_ in (-1, 1): a_grille(T((s_ * 7.98, fy + 2.0, 3.4)) @ Matrix.Rotation(0 if s_ < 0 else pi, 4, 'Z'), 'archL' if s_ < 0 else 'archR')
a_pallet(T((-6.7, 8.4, 0), (0, 0, 0.3))); a_pallet(T((6.9, 10.9, 0), (0, 0, -1.4)))
for x, y, m_ in ((-6.9, -0.6, 't_paint'), (-6.35, -0.25, 't_orange'), (-7.0, 0.1, 't_paint')): a_drum(T((x, y, 0)), 'props', m_)
a_stepladder(T((-6.9, 15.7, 0), (0, 0, 0.4))); a_pegboard(T((7.98, 17.0, 1.25)) @ Matrix.Rotation(pi, 4, 'Z'))
a_floorhatch(T((-3.4, 7.5, 0))); a_floorhatch(T((3.4, 7.5, 0)))
for c, _ in EXHIBITS:
    out = 1 if c.x > 0 else -1
    a_stanchion(T((c.x + out * 1.95, c.y - 1.95, 0)), 'props', L=3.9)
    for yy in (c.y - 1.95, c.y + 1.95): a_stanchion(T((c.x - 1.95, yy, 0)) @ Matrix.Rotation(-pi / 2, 4, 'Z'), 'props', L=3.9, posts=(3.9,) if out < 0 else (0,))
for s_ in (-1, 1): a_duct(T((s_ * 6.95, Y0 + 1.0, 5.0)), 'archL' if s_ < 0 else 'archR', L=Y1 - Y0 - 2.0)

cam = bpy.data.cameras.new('Hero'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(50); cam.clip_start = 0.1; cam.clip_end = 5000
co = bpy.data.objects.new('Hero', cam); scene.collection.objects.link(co)
co.location = CAM_POS; co.rotation_euler = (CAM_TGT - CAM_POS).to_track_quat('-Z', 'Y').to_euler(); scene.camera = co
w = bpy.data.worlds.new('Dark'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1); scene.world = w
scene.render.engine = 'CYCLES'
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
light_level(3)
scene['lobby'] = dict(room='projects', focus=[{'c': [-4.6, 2.5, 1.3], 'r': 1.5, 'dir': [1, -0.9, 0.25]}, {'c': [4.6, 2.5, 1.4], 'r': 1.6, 'dir': [-1, -0.9, 0.25]}, {'c': [-4.6, 12.5, 1.3], 'r': 1.3, 'dir': [1, -0.9, 0.25]}, {'c': [4.6, 12.5, 1.6], 'r': 1.3, 'dir': [-1, -0.9, 0.25]}, {'c': [0, 19, 3.1], 'r': 3.0, 'dir': [0.15, -1, -0.1]}], exposure=1.1, doors=DOORS, screens=[f'FX_screen{i}' for i in range(4)], cam=list(CAM_POS), tgt=list(CAM_TGT), close=list(CLOSE_POS), close_tgt=list(CLOSE_TGT), fov=50.0,
                      floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=2.0), y0=Y0, y1=Y1, dust=dict(x=14, y0=Y0, y1=Y1, h=8),
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'projects.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
