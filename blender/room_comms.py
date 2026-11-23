"""
COMMS room: the station's signal room at the bow, in the manner of a Culture ship rather than a control room. Pale, quiet,
vaulted on the ring's 4 m hull frames, with a wide window on the same Earth as the Lounge and the Library. What you come
for is not modelled here: the terminal is a field drawn live above the plinth by public/js/comms.js, with its drone.

Run:  blender -b --python room_comms.py      -> comms.blend
"""
import os
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'build_scene.py')).read()
exec(_src.split('# ---- everything above this line is the shared kit')[0], globals())

random.seed(31)
WD = 8.0; Y0, Y1 = -6.0, 12.0                             # 16 x 18 m, the bow half of the ring (docs/rolling-earth-plan.md)
HW, RISE = 4.2, 3.0; H = HW + RISE                        # walls, then an elliptical vault on the hull frames
CAM_POS = Vector((0, Y0 + 2.4, 1.6))
WIN_Z0, WIN_W = 0.6, 5.6                                   # the window fills the bow wall below the vault
_lobby_el = math.atan2(5.65 - 1.65, 26.0 + 4.2)          # same elevation to the window as the Atrium's camera to its Oculus
PORTAL_C = Vector((0, Y1, CAM_POS.z + (Y1 - CAM_POS.y) * math.tan(_lobby_el)))
CAM_TGT = Vector((0.6, Y1, PORTAL_C.z - 0.55))
TERM = Vector((1.6, Y1 - 7.0, 0))                          # the plinth, right of centre in the opening view and clear of the page text;
                                                          # the field floats above it at FIELD_Z, facing the room
FIELD_Z = 1.62
CLOSE_POS = Vector((-1.2, Y1 - 8.0, 1.65)); CLOSE_TGT = Vector((-1.5, Y1 + 3, 2.2))
FLOOR_ROUGH = (0.1, 0.14); FLOOR_IOR = 1.55

mat('shell', (0.66, 0.64, 0.6), 0.55, var=0.04)                                  # warm pale plaster
mat('rib', (0.8, 0.79, 0.76), 0.3, 0.0, 1.5, 0.3, var=0.05)
mat('linen', (0.62, 0.57, 0.5), 0.9)
mat('wood_l', (0.42, 0.26, 0.13), 0.5, var=0.1, seams=(0, 0.3, 0))
mat('frame', (0.03, 0.03, 0.035), 0.35, 0.8)
EM.update({'cove': ((1.0, 0.86, 0.7), 3.0), 'orb': ((1.0, 0.84, 0.66), 6.0), 'field': ((0.62, 0.9, 1.0), 1.2), 'cool': ((0.5, 0.82, 1.0), 1.6)})
for k in ('cove', 'orb', 'field', 'cool'):
    mat('EM_' + k, (0, 0, 0), 0.5, emis=EM[k][0], estr=EM[k][1])
def spot(name, loc, watts, color=(1.0, 0.84, 0.66), size=100):
    l = bpy.data.lights.new(name, 'SPOT'); l.energy = watts; l.color = color; l.spot_size = math.radians(size); l.spot_blend = 0.5; l.shadow_soft_size = 0.08
    o = bpy.data.objects.new(name, l); COL.objects.link(o); o.location = loc
    o.visible_glossy = False      # a reflection shows the glowing fitting (in the probes), not a lamp: no per-pixel highlight
    return o
def vault(r, n=24):
    """The vault's half-ellipse as (x, z) points from +x to -x, offset r outward (r < 0: into the room)."""
    return [((WD + r) * math.cos(pi * i / n), HW + (RISE + r) * math.sin(pi * i / n)) for i in range(n + 1)]

# ================================================================= SHELL
quad('floor_near', [(-WD, Y0, 0), (WD, Y0, 0), (WD, 3, 0), (-WD, 3, 0)], 'floor', 'floorN')
quad('floor_far', [(-WD, 3, 0), (WD, 3, 0), (WD, Y1, 0), (-WD, Y1, 0)], 'floor', 'floorF')
band('vault', vault(0.25), vault(0.0), Y0, Y1, 'shell', 'archC')
for s in (1, -1):
    g = 'archR' if s > 0 else 'archL'
    quad(f'wall_{g}', [(s * WD, Y0, 0), (s * WD, Y1, 0), (s * WD, Y1, HW), (s * WD, Y0, HW)], 'shell', g)
    box(f'skirt_{g}', s * (WD - 0.04), s * WD, Y0, Y1, 0, 0.12, 'rib', g)
# end walls: the vault's lunette over a flat wall; the bow one is mostly window
prism('backwall', [(-WD, 0), (WD, 0)] + vault(0.0), 'Y', Y0 - 0.3, Y0, 'shell', 'back')
# ---- hull frames every 4 m: slim ribs down the walls and over the vault, each lighting the vault from both flanks
for k, y in enumerate((-4.0, 0.0, 4.0, 8.0)):
    band(f'rib{k}', vault(0.0), vault(-0.22), y - 0.14, y + 0.14, 'rib', 'archC', bevel=0.02)
    for s in (1, -1):
        box(f'pilaster{k}', s * (WD - 0.22), s * WD, y - 0.14, y + 0.14, 0, HW, 'rib', 'archR' if s > 0 else 'archL', bevel=0.02)
    for d in (-1, 1):
        band(f'cove{k}', vault(-0.2), vault(-0.215), y + d * 0.15, y + d * 0.16, em='cove')

# ================================================================= THE WINDOW
# The whole bow wall is window: an arch that follows the vault, inset WIN_INSET, a low sill, two slender mullions.
WIN_INSET = 0.55
def arch(r, n=24):
    """The window's arch as (x, z), from +x over to -x, offset r outward."""
    return [((WIN_W + r) * math.cos(pi * i / n), HW + (RISE - WIN_INSET + r) * math.sin(pi * i / n)) for i in range(n + 1)]
band('bow_frame', [(WD, 0)] + vault(0.0) + [(-WD, 0)], [(WIN_W, WIN_Z0)] + arch(0.0) + [(-WIN_W, WIN_Z0)], Y1 - 0.6, Y1, 'rib', 'center')
box('win_b', -WIN_W, WIN_W, Y1 - 0.6, Y1, 0, WIN_Z0, 'rib', 'center', bevel=0.03)
box('sill', -WIN_W, WIN_W, Y1 - 0.95, Y1 - 0.55, WIN_Z0 - 0.05, WIN_Z0, 'wood_l', 'center', bevel=0.015)
band('arch_glaze_bead', arch(0.0), arch(-0.05), Y1 - 0.2, Y1 - 0.08, 'frame', 'center')
for x in (-WIN_W / 2, WIN_W / 2):
    top = HW + (RISE - WIN_INSET) * math.sqrt(1 - (x / WIN_W) ** 2)
    box('mullion', x - 0.03, x + 0.03, Y1 - 0.18, Y1 - 0.08, WIN_Z0, top, 'frame', 'center')
box('win_cove', -WIN_W + 0.1, WIN_W - 0.1, Y1 - 0.55, Y1 - 0.51, WIN_Z0 - 0.1, WIN_Z0 - 0.085, em='cool')

# ================================================================= THE TERMINAL'S PLINTH (the field and the drone are live, comms.js)
lathe('plinth', [(0, 0), (0.34, 0), (0.32, 0.04), (0.08, 0.14), (0.055, 0.86), (0.1, 0.93), (0.3, 0.99), (0.32, 1.02), (0, 1.02)],
      'white', 'props', segs=48, closed=False, M=T(TERM))
lathe('plinth_ring', [(0.27, 1.02), (0.31, 1.02), (0.31, 1.03), (0.27, 1.03)], em='field', segs=64, M=T(TERM))
lathe('plinth_foot', [(0.36, 0.0), (0.4, 0.0), (0.4, 0.006), (0.36, 0.006)], em='field', segs=64, M=T(TERM))
lathe('term_halo', [(1.05, 0.0), (1.08, 0.0), (1.08, 0.004), (1.05, 0.004)], em='field', segs=96, M=T(TERM))   # inlaid in the floor: the place to stand, seen from the door

# ================================================================= A CRESCENT OF SEATS facing the window, low tables
SEAT_C, SEAT_R = Vector((-2.6, Y1 - 4.6, 0)), 2.6                   # left, behind the page text: the terminal has the middle
lathe('crescent', [(SEAT_R - 0.38, 0.0), (SEAT_R + 0.38, 0.0), (SEAT_R + 0.38, 0.42), (SEAT_R - 0.38, 0.42)], 'linen', 'props',
      segs=40, a0=math.radians(200), a1=math.radians(340), bevel=0.05, M=T(SEAT_C))
lathe('crescent_back', [(SEAT_R + 0.26, 0.42), (SEAT_R + 0.42, 0.42), (SEAT_R + 0.42, 0.82), (SEAT_R + 0.3, 0.82)], 'linen', 'props',
      segs=40, a0=math.radians(200), a1=math.radians(340), bevel=0.04, M=T(SEAT_C))
lathe('crescent_plinth', [(SEAT_R - 0.32, 0.0), (SEAT_R + 0.36, 0.0), (SEAT_R + 0.36, 0.06), (SEAT_R - 0.32, 0.06)], 'wood_l', 'props',
      segs=40, a0=math.radians(198), a1=math.radians(342), M=T(SEAT_C))
lathe('table', [(0, 0.38), (0.55, 0.38), (0.58, 0.35), (0.3, 0.04), (0.3, 0.0), (0, 0)], 'white', 'props', segs=48, M=T(SEAT_C))

# ================================================================= LIGHT: floating lamps (Culture: no cables), coves, downlights
for y in (-2.0, 2.0, 6.0):
    for x in (-4.2, 4.2):
        lathe('orb', [(0, -0.2), (0.12, -0.17), (0.2, -0.06), (0.2, 0.06), (0.12, 0.17), (0, 0.2)], em='orb', segs=24, M=T((x, y, 4.9)))
        l = bpy.data.lights.new('orb_glow', 'POINT'); l.energy = 120; l.color = (1.0, 0.84, 0.66); l.shadow_soft_size = 0.2
        o = bpy.data.objects.new('orb_glow', l); COL.objects.link(o); o.location = (x, y, 4.9); o.visible_glossy = False
for y in (-2.0, 2.0, 6.0, 9.6):
    spot('down', (0, y, H - 0.35), 160)
spot('term_key', (TERM.x + 0.4, TERM.y - 0.6, H - 0.4), 35, size=40)            # a quiet pool on the plinth

# ================================================================= WALLS: two signal screens, the door to the Midway
RX = WD - 0.22
for i, yc in enumerate((1.9, 6.1)):
    box(f'bezel{i}', RX - 0.06, WD, yc - 1.0, yc + 1.0, 1.4, 2.8, 'frame', 'archR', bevel=0.01)
    quad(f'FX_screen{i}', [(RX - 0.065, yc + 0.93, 1.47), (RX - 0.065, yc - 0.93, 1.47), (RX - 0.065, yc - 0.93, 2.73), (RX - 0.065, yc + 0.93, 2.73)], 'lum_screen', fx='screen', uv=True)
pressure_door('door', T((-WD + 0.02, -2.0, 0)), 'archL', 'ATRIUM', 'MIDWAY  ·  RING LINE', 'lobby', w=1.6, h=2.4)

# ================================================================= PLANTS by the window (the same kind as the Lounge's)
for d in (-1, 1):
    c = Vector((d * 6.3, Y1 - 1.6, 0))
    lathe(f'pot{d}', [(0, 0.6), (0.42, 0.6), (0.46, 0.54), (0.36, 0.0), (0, 0)], 'white', 'props', segs=32, closed=False, M=T(c))
    bm = bmesh.new()
    for pi_ in range(12):
        a = random.uniform(0, 2 * pi); rr = 0.3 * math.sqrt(random.random()); cx, cy = c.x + math.cos(a) * rr, c.y + math.sin(a) * rr
        for li in range(8):
            ph = random.uniform(0, 2 * pi); L = random.uniform(1.2, 2.6); lean = random.uniform(0.03, 0.25); wd = random.uniform(0.035, 0.07); prev = None
            for sgi in range(8):
                t = sgi / 7; p = Vector((cx + math.cos(ph) * lean * t * t * L, cy + math.sin(ph) * lean * t * t * L, 0.56 + L * t * (1 - 0.2 * lean * t)))
                dd = Vector((math.cos(ph + pi / 2), math.sin(ph + pi / 2), 0)) * (wd * (1 - t ** 2.2) + 0.002)
                cur = (bm.verts.new(p - dd), bm.verts.new(p + dd))
                if prev: bm.faces.new((prev[0], prev[1], cur[1], cur[0]))
                prev = cur
    for f in bm.faces: f.smooth = True
    finish(f'pot_plant{d}', bm, 'leaf', 'props')

# ================================================================= OUTSIDE: the same Earth as the Atrium, the Lounge and the Library
SUN_EL, SUN_AZ = math.radians(12.5), math.radians(1.5)
SUN_DIR = Vector((math.sin(SUN_AZ) * math.cos(SUN_EL), math.cos(SUN_AZ) * math.cos(SUN_EL), math.sin(SUN_EL)))
PEOPLE = False
_out = _src.split('# ================================================================= OUTSIDE (Earth seen from low orbit, stars)')[1].split('# ================================================================= LIGHTS / CAMERA')[0]
exec(_out, globals())
sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 9.0; sun.color = (1.0, 0.77, 0.54); sun.angle = math.radians(0.9)
so = bpy.data.objects.new('Sun', sun); COL.objects.link(so); so.rotation_euler = SUN_DIR.to_track_quat('Z', 'Y').to_euler()

cam = bpy.data.cameras.new('Hero'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(50); cam.clip_start = 0.1; cam.clip_end = 5000
co = bpy.data.objects.new('Hero', cam); scene.collection.objects.link(co)
co.location = CAM_POS; co.rotation_euler = (CAM_TGT - CAM_POS).to_track_quat('-Z', 'Y').to_euler(); scene.camera = co
scene.render.engine = 'CYCLES'
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
light_level(2)                      # the same refit level as the Lounge next door
facing = (CAM_POS - (TERM + Vector((0, 0, FIELD_Z)))); facing.z = 0; facing.normalize()
scene['lobby'] = dict(room='comms', exposure=1.3, cam=list(CAM_POS), tgt=list(CAM_TGT), close=list(CLOSE_POS), close_tgt=list(CLOSE_TGT), fov=50.0,
                      doors=DOORS, screens=['FX_screen0', 'FX_screen1'],
                      comms=dict(c=list(TERM + Vector((0, 0, FIELD_Z))), facing=list(facing)),     # where comms.js unfolds the field
                      portal=list(PORTAL_C), sun=list(SUN_DIR), backdrop_fov=100,
                      spin=dict(axis=[0.0, 1.0, 0.0], period=120.0, sun_e=[sun.energy * c for c in sun.color], half=WIN_W + 1.6), earth=dict(c=list(EARTH_C), r=EARTH_R, u=list(EARTH_U)),
                      floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=1.2), y0=Y0, y1=Y1,
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'comms.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
