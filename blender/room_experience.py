"""
EXPERIENCE room — "Navigation": a round, domed chart room. In the middle, a projection table; above it floats the
route map (drawn live in three.js, see public/js/routemap.js): a rail line climbing from station to station,
one station per stop in a career. The room itself is quiet, dark and symmetrical so the map is the only star.

Run:  blender -b --python room_experience.py      -> experience.blend
"""
import os
_here = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(_here, 'build_scene.py')).read().split('# ---- everything above this line is the shared kit')[0], globals())

random.seed(5)
R = 9.0; WALL_H = 3.6; APEX = 8.4; OCULUS = 1.7
Y0, Y1 = -R, R
CAM_POS = Vector((0, -7.3, 1.7)); CAM_TGT = Vector((0, 0.4, 2.75))
CLOSE_POS = Vector((2.9, -3.6, 1.75)); CLOSE_TGT = Vector((-0.2, 0.3, 2.6))
TABLE_R, TABLE_H = 3.1, 0.62
FLOOR_ROUGH = (0.1, 0.13); FLOOR_IOR = 1.6
EM.update({'riblight': ((0.5, 0.86, 1.0), 1.1), 'gold': ((1.0, 0.66, 0.26), 4.0), 'cool': ((0.45, 0.8, 1.0), 2.4), 'core': ((0.2, 0.8, 1.0), 5.0), 'sky': ((0.35, 0.55, 1.0), 0.9)})
for k in ('riblight', 'gold', 'cool', 'core', 'sky'):
    mat('EM_' + k, (0, 0, 0), 0.5, emis=EM[k][0], estr=EM[k][1])
mat('navy', (0.03, 0.05, 0.11), 0.5, var=0.08)
mat('leather', (0.16, 0.07, 0.035), 0.42, var=0.08)

def rbox(name, size, M, m, grp, bevel=0.0, **kw):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
    return finish(name, bm, m, grp, bevel=bevel, M=M, **kw)
def polar(a, r, z=0.0):
    return Vector((r * math.cos(math.radians(a)), r * math.sin(math.radians(a)), z))
def at(a, r, z=0.0, yaw=0.0):
    """Frame at angle a on radius r, local +x pointing outwards."""
    return Matrix.Translation(polar(a, r, z)) @ Matrix.Rotation(math.radians(a + yaw), 4, 'Z')
def spot(name, loc, target, watts, size=45, color=(1.0, 0.86, 0.7)):
    l = bpy.data.lights.new(name, 'SPOT'); l.energy = watts; l.spot_size = math.radians(size); l.spot_blend = 0.4; l.color = color; l.shadow_soft_size = 0.1
    o = bpy.data.objects.new(name, l); COL.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return o

# ================================================================= SHELL: drum wall, dome, oculus
quad('floor', [(-R - 0.5, -R - 0.5, 0), (R + 0.5, -R - 0.5, 0), (R + 0.5, R + 0.5, 0), (-R - 0.5, R + 0.5, 0)], 'floor', 'floorN')
DOME = [(OCULUS + (R - OCULUS) * math.cos(t * pi / 2 / 24), WALL_H + (APEX - WALL_H) * math.sin(t * pi / 2 / 24)) for t in range(25)]
lathe('drum', [(R, 0), (R, WALL_H)], 'wall', 'archL', segs=96, closed=False)
lathe('dome', DOME, 'navy', 'archC', segs=96, closed=False)
lathe('base', [(R, 0.0), (R - 0.14, 0.0), (R - 0.14, 0.45), (R, 0.5)], 'plat', 'archL', segs=96, closed=False)
# cornice at the springing of the dome, hiding a ring of light that washes up into it
lathe('cornice', [(R, WALL_H - 0.25), (R - 0.5, WALL_H - 0.12), (R - 0.5, WALL_H + 0.1), (R - 0.42, WALL_H + 0.1), (R - 0.42, WALL_H - 0.04), (R, WALL_H + 0.02)], 'rib', 'archR', segs=96)
lathe('cove', [(R - 0.36, WALL_H + 0.0), (R - 0.12, WALL_H + 0.02), (R - 0.12, WALL_H + 0.035), (R - 0.36, WALL_H + 0.015)], em='cool', segs=96)
lathe('cornice_inlay', [(R - 0.505, WALL_H - 0.06), (R - 0.5, WALL_H - 0.06), (R - 0.5, WALL_H + 0.04), (R - 0.505, WALL_H + 0.04)], 'brass', 'archR', segs=96)
# oculus: a brass ring and a disc of deep sky
lathe('oculus_ring', [(OCULUS, APEX - 0.05), (OCULUS + 0.3, APEX - 0.22), (OCULUS + 0.3, APEX + 0.05), (OCULUS, APEX + 0.05)], 'brass', 'archR', segs=64)
lathe('oculus_sky', [(0, APEX + 0.04), (OCULUS, APEX + 0.04)], em='sky', segs=48, closed=False)
# twelve ribs running from the floor up the dome to the oculus, each with a hairline of light
def rib_path(off):
    pts = [(R - off, 0.0), (R - off, WALL_H)]
    for t in range(1, 25):
        a = t * pi / 2 / 24; r0 = OCULUS + (R - OCULUS) * math.cos(a); z0 = WALL_H + (APEX - WALL_H) * math.sin(a)
        nx, nz = math.cos(a) * (APEX - WALL_H), math.sin(a) * (R - OCULUS); n = math.hypot(nx, nz)        # ellipse normal
        pts.append((r0 - off * nx / n, z0 - off * nz / n))
    return pts
for k in range(12):
    a = math.radians(k * 30)
    lathe(f'rib{k}', rib_path(-0.02) + list(reversed(rib_path(0.32))), 'rib', 'archR', segs=2, a0=a - 0.03, a1=a + 0.03)
    lathe(f'ribled{k}', rib_path(0.322) + list(reversed(rib_path(0.332))), em='riblight', segs=1, a0=a - 0.0035, a1=a + 0.0035)
# constellation studs in the dome: small brass-set lights, denser towards the top
for i in range(110):
    t = random.uniform(0.12, 0.95) * pi / 2; a = random.uniform(0, 2 * pi)
    r0 = OCULUS + (R - OCULUS) * math.cos(t) - 0.02; z0 = WALL_H + (APEX - WALL_H) * math.sin(t) - 0.02
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=random.choice((0.012, 0.018, 0.026)))
    finish('star', bm, None, em='sign', M=Matrix.Translation((r0 * math.cos(a), r0 * math.sin(a), z0)))

# ================================================================= WALL BAYS (between the ribs)
SCREENS = (45, 75, 105, 135)
for k in range(12):
    a = 15 + k * 30
    if a == 255 or a == 285: continue                                         # the bulkhead door to Fabrication, behind the camera
    M = at(a, R - 0.06)
    if a == 15:                                                               # the stair door down to the Ring Line
        rbox(f'panel{k}', (0.08, 3.2, 3.2), M @ T((-0.01, 0, 1.7)), 'dark', 'archL', bevel=0.02)
        pressure_door('door', at(a, R - 0.12, 0, 180), 'archL', 'ATRIUM', 'RING LINE  ·  STAIR', 'index.html', w=1.6, h=2.4)
        continue
    if a in SCREENS:
        rbox(f'bezel{k}', (0.1, 3.0, 2.0), M @ T((-0.02, 0, 2.3)), 'dark', 'archL', bevel=0.02)
        c = polar(a, R - 0.135, 0); t = Vector((-math.sin(math.radians(a)), math.cos(math.radians(a)), 0))
        quad(f'FX_screen{k}', [tuple(c + t * 1.4 + Vector((0, 0, 1.4))), tuple(c - t * 1.4 + Vector((0, 0, 1.4))), tuple(c - t * 1.4 + Vector((0, 0, 3.2))), tuple(c + t * 1.4 + Vector((0, 0, 3.2)))],
             'lum_screen', fx='screen', uv=True)
    else:
        rbox(f'panel{k}', (0.08, 3.2, 2.5), M @ T((-0.01, 0, 2.0)), 'wall2', 'archL', bevel=0.02)
        for d in (-1, 1):
            rbox(f'panelled{k}', (0.03, 0.03, 2.3), M @ T((-0.06, d * 1.45, 2.0)), None, None, em='gold')
        rbox(f'panelbrass{k}', (0.02, 2.6, 0.03), M @ T((-0.06, 0, 3.0)), 'brass', 'archL')
    # bench seat built into each bay
    rbox(f'seat{k}', (0.55, 2.6, 0.1), M @ T((-0.34, 0, 0.5)), 'leather', 'props', bevel=0.03, seg=3)
    rbox(f'seatbase{k}', (0.5, 2.5, 0.42), M @ T((-0.32, 0, 0.24)), 'wall2', 'props')
# entrance: a tall doorway with a lit reveal
Me = at(270, R - 0.1)
rbox('door_frame', (0.5, 3.4, 3.3), Me @ T((-0.05, 0, 1.65)), 'rib', 'archL', bevel=0.03)
rbox('door_leaf', (0.1, 2.6, 2.9), Me @ T((-0.28, 0, 1.47)), 'wall2', 'archL', bevel=0.02)
rbox('door_light', (0.04, 2.6, 0.04), Me @ T((-0.31, 0, 2.95)), None, None, em='gold')

# ================================================================= THE TABLE
lathe('table', [(0, TABLE_H), (TABLE_R, TABLE_H), (TABLE_R, TABLE_H - 0.1), (TABLE_R - 0.16, TABLE_H - 0.1), (TABLE_R - 0.5, 0.0)], 'plat', 'center', segs=128, closed=False)
lathe('table_led', [(TABLE_R - 0.15, TABLE_H - 0.115), (TABLE_R - 0.03, TABLE_H - 0.115), (TABLE_R - 0.03, TABLE_H - 0.105), (TABLE_R - 0.15, TABLE_H - 0.105)], em='stair', segs=128)
lathe('table_rim', [(TABLE_R - 0.02, TABLE_H), (TABLE_R + 0.02, TABLE_H), (TABLE_R + 0.02, TABLE_H + 0.03), (TABLE_R - 0.02, TABLE_H + 0.03)], 'brass', 'center', segs=128)
lathe('table_glass', [(0, TABLE_H + 0.004), (TABLE_R - 0.02, TABLE_H + 0.004)], 'glasstop', 'center', segs=96, closed=False)
for r in (0.9, 1.7, 2.5):
    lathe(f'table_ring{r}', [(r, TABLE_H + 0.006), (r + 0.02, TABLE_H + 0.006)], 'brass', 'center', segs=96, closed=False)
lathe('lens', [(0, TABLE_H + 0.008), (0.5, TABLE_H + 0.008)], em='core', segs=48, closed=False)
lathe('lens_ring', [(0.5, TABLE_H), (0.62, TABLE_H), (0.62, TABLE_H + 0.05), (0.5, TABLE_H + 0.05)], 'chrome', 'center', segs=48)
# the light the map itself throws on the room (the map is drawn in three.js)
for z, wts, col in ((2.4, 420, (1.0, 0.68, 0.3)), (3.6, 260, (0.3, 0.75, 1.0))):
    l = bpy.data.lights.new('mapglow', 'POINT'); l.energy = wts; l.color = col; l.shadow_soft_size = 1.2
    o = bpy.data.objects.new('mapglow', l); COL.objects.link(o); o.location = (0, 0, z); o.visible_glossy = False

# ================================================================= FLOOR: brass rings, compass rose lines, marker lights
for r in (4.2, 6.7):
    lathe(f'inlay{r}', [(r, 0.0), (r + 0.06, 0.0), (r + 0.06, 0.003), (r, 0.003)], 'brass', 'center', segs=128)
for k in range(12):
    a = k * 30
    rbox(f'ray{k}', (2.44, 0.03, 0.003), at(a, 5.45, 0.0015), 'brass', 'center')
    lathe(f'marker{k}', [(0, 0.004), (0.04, 0.004), (0.04, 0.0), (0, 0.0)], em='mark', segs=12, closed=False, M=T(polar(a + 15, 6.73, 0)))

# ================================================================= CONSOLES: five lecterns round the table (none in the approach)
for i, a in enumerate((200, 150, 90, 30, 340)):
    M = at(a, 4.75)
    rbox(f'con_body{i}', (0.5, 1.5, 0.95), M @ T((0.05, 0, 0.475)), 'wall2', 'center', bevel=0.03)
    rbox(f'con_top{i}', (0.7, 1.6, 0.06), M @ T((-0.02, 0, 1.0), (0, -0.38, 0)), 'dark', 'center', bevel=0.015)
    rbox(f'con_glow{i}', (0.5, 1.3, 0.005), M @ T((-0.035, 0, 1.035), (0, -0.38, 0)), 'lum_screen', 'center')
    rbox(f'con_trim{i}', (0.02, 1.6, 0.03), M @ T((-0.35, 0, 0.9)), 'brass', 'center')
    rbox(f'con_led{i}', (0.02, 1.4, 0.02), M @ T((0.3, 0, 0.06)), None, None, em='gold')
    lathe(f'stool{i}', [(0, 0.62), (0.2, 0.62), (0.22, 0.56), (0.05, 0.52), (0.05, 0.04), (0.2, 0.02), (0.2, 0), (0, 0)], 'leather', 'props', segs=24, closed=False, M=T(polar(a, 5.6, 0)))
    spot(f'con_spot{i}', polar(a, 5.2, 5.6), polar(a, 4.9, 0.9), 320, 40)
for a in (60, 120, 0, 180):                                                    # soft pools on the outer floor
    spot(f'pool{a}', polar(a, 7.2, 5.0), polar(a, 7.4, 0), 380, 55, color=(0.7, 0.85, 1.0))

cam = bpy.data.cameras.new('Hero'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(50); cam.clip_start = 0.1; cam.clip_end = 5000
co = bpy.data.objects.new('Hero', cam); scene.collection.objects.link(co)
co.location = CAM_POS; co.rotation_euler = (CAM_TGT - CAM_POS).to_track_quat('-Z', 'Y').to_euler(); scene.camera = co
w = bpy.data.worlds.new('Dark'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1); scene.world = w
scene.render.engine = 'CYCLES'
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
scene['lobby'] = dict(room='experience', exposure=1.5, cam=list(CAM_POS), tgt=list(CAM_TGT), close=list(CLOSE_POS), close_tgt=list(CLOSE_TGT), fov=50.0,
                      doors=DOORS, map=dict(c=[0.0, 0.0, TABLE_H], r=TABLE_R), floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=1.5), y0=Y0, y1=Y1,
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'experience.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
