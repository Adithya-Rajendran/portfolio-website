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

# ASSET=<name> benches shared station hardware or a Navigation asset with its room palette.
exec(open(os.path.join(_here, 'assets_tech.py')).read(), globals())
exec(open(os.path.join(_here, 'assets_projection.py')).read(), globals())
bench({**TECH, **NAVIGATION_PROJECTION})

# ================================================================= SHELL: drum wall, dome, oculus
quad('floor', [(-R - 0.5, -R - 0.5, 0), (R + 0.5, -R - 0.5, 0), (R + 0.5, R + 0.5, 0), (-R - 0.5, R + 0.5, 0)], 'floor', 'floorN')
DOME = [(OCULUS + (R - OCULUS) * math.cos(t * pi / 2 / 24), WALL_H + (APEX - WALL_H) * math.sin(t * pi / 2 / 24)) for t in range(25)]
lathe('drum', [(R, 0), (R, WALL_H)], 'wall', 'archL', segs=96, closed=False)
lathe('dome', DOME, 'navy', 'archC', segs=96, closed=False)
lathe('base', [(R, 0.0), (R - 0.14, 0.0), (R - 0.14, 0.45), (R, 0.5)], 'plat', 'archL', segs=96, closed=False)
# ---- Cornice and cove lighting at the foot of the dome
lathe('cornice', [(R, WALL_H - 0.25), (R - 0.5, WALL_H - 0.12), (R - 0.5, WALL_H + 0.1), (R - 0.42, WALL_H + 0.1), (R - 0.42, WALL_H - 0.04), (R, WALL_H + 0.02)], 'rib', 'archR', segs=96)
lathe('cove', [(R - 0.36, WALL_H + 0.0), (R - 0.12, WALL_H + 0.02), (R - 0.12, WALL_H + 0.035), (R - 0.36, WALL_H + 0.015)], em='cool', segs=96)
lathe('cornice_inlay', [(R - 0.505, WALL_H - 0.06), (R - 0.5, WALL_H - 0.06), (R - 0.5, WALL_H + 0.04), (R - 0.505, WALL_H + 0.04)], 'brass', 'archR', segs=96)
# ---- Oculus ring and sky disc
lathe('oculus_ring', [(OCULUS, APEX - 0.05), (OCULUS + 0.3, APEX - 0.22), (OCULUS + 0.3, APEX + 0.05), (OCULUS, APEX + 0.05)], 'brass', 'archR', segs=64)
lathe('oculus_sky', [(0, APEX + 0.04), (OCULUS, APEX + 0.04)], em='sky', segs=48, closed=False)
# ---- Twelve dome ribs with light strips
for k in range(12):
    a_dome_rib(I4, azimuth=math.radians(k * 30), radius=R, wall_h=WALL_H, apex=APEX, oculus=OCULUS, index=k)
# ---- Constellation studs in the dome
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
        pressure_door('door', at(a, R - 0.12, 0, 180), 'archL', 'ATRIUM', 'RING LINE  ·  STAIR', 'lobby', w=1.6, h=2.4)
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
        a_grille(at(a, R - 0.11, 2.45, 180), 'archL', w=1.6, h=0.5)
        if k % 3 == 0: a_extinguisher(at(a, R - 0.11, 0.75, 180) @ T((0, 1.1, 0)), 'props')
    # bench seat built into each bay
    a_wall_seat(M, index=k)
# ---- Rear entry surround, leaf and light
Me = at(270, R - 0.1)
rbox('door_frame', (0.5, 3.4, 3.3), Me @ T((-0.05, 0, 1.65)), 'rib', 'archL', bevel=0.03)
rbox('door_leaf', (0.1, 2.6, 2.9), Me @ T((-0.28, 0, 1.47)), 'wall2', 'archL', bevel=0.02)
rbox('door_light', (0.04, 2.6, 0.04), Me @ T((-0.31, 0, 2.95)), None, None, em='gold')

# ================================================================= THE TABLE
a_map_table(I4, radius=TABLE_R, height=TABLE_H)
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

for a_ in (0, 180): a_kiosk(at(a_, 7.7, 0, 180), 'props')
# ================================================================= CONSOLES: five lecterns round the table (none in the approach)
for i, a in enumerate((200, 150, 90, 30, 340)):
    M = at(a, 4.75)
    a_console(M, 'center', w=1.6); a_opchair(at(a, 5.75, 0, 180) @ Matrix.Rotation(random.uniform(-0.5, 0.5), 4, 'Z'))
    rbox(f'con_led{i}', (0.02, 1.4, 0.02), M @ T((0.3, 0, 0.06)), None, None, em='gold')
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
                      doors=DOORS, screens=[f'FX_screen{k}' for k in (4, 3, 2, 1)], map=dict(c=[0.0, 0.0, TABLE_H], r=TABLE_R), floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=1.5), y0=Y0, y1=Y1,
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'experience.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
