"""
ABOUT room — "Observation Lounge": a quiet, warm, double-height room with one enormous window onto Earth.
The planet outside is the same model, at the same moment, as in the lobby's "last look": the camera-to-window
direction has the same elevation as the lobby's camera-to-portal direction, so horizon, sun, Moon and aurora line up.

Run:  blender -b --python room_about.py      -> about.blend
"""
import os
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'build_scene.py')).read()
exec(_src.split('# ---- everything above this line is the shared kit')[0], globals())

random.seed(23)
WD = 7.0; Y0, Y1 = -6.0, 9.0; H = 6.6
CAM_POS = Vector((0, -3.9, 1.55))
WIN_Z0, WIN_Z1, WIN_W = 0.55, 5.9, 6.2                    # the window: almost the whole end wall
_lobby_el = math.atan2(5.65 - 1.65, 26.0 + 4.2)          # elevation of the lobby's camera -> portal direction
PORTAL_C = Vector((0, Y1, CAM_POS.z + (Y1 - CAM_POS.y) * math.tan(_lobby_el)))
CAM_TGT = Vector((0, Y1, PORTAL_C.z - 0.35))
CLOSE_POS = Vector((1.55, 5.2, 1.6)); CLOSE_TGT = Vector((1.5, Y1 + 4, 3.3))
FLOOR_ROUGH = (0.12, 0.15); FLOOR_IOR = 1.55

mat('wood', (0.2, 0.1, 0.045), 0.42, 0.0, 1.5, 0.25, var=0.1, seams=(0.24, 0, 0))            # walnut boards
mat('wood_l', (0.42, 0.26, 0.13), 0.5, var=0.1, seams=(0, 0.3, 0))
mat('plaster', (0.34, 0.32, 0.3), 0.7, var=0.05)
mat('rug', (0.33, 0.11, 0.05), 0.95)
mat('rug2', (0.62, 0.5, 0.36), 0.95)
mat('linen', (0.62, 0.57, 0.5), 0.9)
mat('leather', (0.16, 0.07, 0.035), 0.42, var=0.08)
mat('frame', (0.03, 0.03, 0.035), 0.35, 0.8)
mat('paper', (0.75, 0.72, 0.66), 0.8)
BOOKS = []
for i, c in enumerate(((0.45, 0.07, 0.05), (0.06, 0.16, 0.3), (0.55, 0.42, 0.2), (0.1, 0.25, 0.14), (0.6, 0.58, 0.52), (0.08, 0.08, 0.09), (0.5, 0.22, 0.05), (0.25, 0.1, 0.2))):
    mat(f'book{i}', c, 0.6); BOOKS.append(f'book{i}')
EM.update({'lamp': ((1.0, 0.56, 0.24), 9.0), 'shelf': ((1.0, 0.68, 0.4), 2.2), 'cool': ((0.5, 0.82, 1.0), 1.6)})
for k in ('lamp', 'shelf', 'cool'):
    mat('EM_' + k, (0, 0, 0), 0.5, emis=EM[k][0], estr=EM[k][1])

def rbox(name, size, M, m, grp, bevel=0.0, **kw):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
    return finish(name, bm, m, grp, bevel=bevel, M=M, **kw)
def glow(name, loc, watts, color=(1.0, 0.58, 0.28), r=0.12):
    l = bpy.data.lights.new(name, 'POINT'); l.energy = watts; l.color = color; l.shadow_soft_size = r
    o = bpy.data.objects.new(name, l); COL.objects.link(o); o.location = loc; return o

# ================================================================= SHELL
quad('floor_near', [(-WD, Y0, 0), (WD, Y0, 0), (WD, 2, 0), (-WD, 2, 0)], 'floor', 'floorN')
quad('floor_far', [(-WD, 2, 0), (WD, 2, 0), (WD, Y1, 0), (-WD, Y1, 0)], 'floor', 'floorF')
quad('ceiling', [(-WD, Y0, H), (WD, Y0, H), (WD, Y1, H), (-WD, Y1, H)], 'plaster', 'archC')
quad('backwall', [(-WD, Y0, 0), (WD, Y0, 0), (WD, Y0, H), (-WD, Y0, H)], 'plaster', 'back')
for s in (1, -1):
    g = 'archR' if s > 0 else 'archL'
    quad(f'wall_{g}', [(s * WD, Y0, 0), (s * WD, Y1, 0), (s * WD, Y1, H), (s * WD, Y0, H)], 'plaster', g)
    box(f'skirt_{g}', s * (WD - 0.03), s * WD, Y0, Y1, 0, 0.14, 'wood', g)
# timber ceiling: deep beams across the room, slats between them, warm light in the gaps
for k, y in enumerate((-4.0, 0.0, 4.0, 8.0)):          # the timber beams case the hull frames, which are 4 m apart everywhere on the ring
    box(f'beam{k}', -WD, WD, y - 0.14, y + 0.14, H - 0.55, H, 'wood', 'archC', bevel=0.012)
    box(f'beamlight{k}', -WD + 0.4, WD - 0.4, y - 0.18, y - 0.15, H - 0.08, H - 0.06, em=em_ramp('step', k, y, 1.4, 0.5, 1.0))
x = -WD + 0.3
while x < WD - 0.2:
    box('slat', x, x + 0.09, Y0, Y1, H - 0.16, H - 0.04, 'wood_l', 'archC'); x += 0.3

# ================================================================= THE WINDOW
# end wall = a deep timber-lined frame around one sheet of space; slim mullions, a low sill to lean on
def frame_piece(name, x0, x1, z0, z1, depth=0.55, m='wood'):
    box(name, x0, x1, Y1 - depth, Y1, z0, z1, m, 'center', bevel=0.015)
frame_piece('win_l', -WD, -WIN_W, 0, H); frame_piece('win_r', WIN_W, WD, 0, H)
frame_piece('win_t', -WIN_W, WIN_W, WIN_Z1, H); frame_piece('win_b', -WIN_W, WIN_W, 0, WIN_Z0)
box('sill', -WIN_W, WIN_W, Y1 - 0.85, Y1 - 0.5, WIN_Z0 - 0.06, WIN_Z0, 'wood_l', 'center', bevel=0.015)
for x in (-3.1, 0.0, 3.1):
    box('mullion', x - 0.035, x + 0.035, Y1 - 0.2, Y1 - 0.08, WIN_Z0, WIN_Z1, 'frame', 'center')
box('transom', -WIN_W, WIN_W, Y1 - 0.2, Y1 - 0.08, 5.05, 5.11, 'frame', 'center')
box('win_cove', -WIN_W + 0.1, WIN_W - 0.1, Y1 - 0.5, Y1 - 0.46, WIN_Z0 - 0.1, WIN_Z0 - 0.085, em='cool')      # faint cool line under the sill

# ================================================================= LEFT WALL: the library of a life (books, objects, a ladder)
SX = -WD
box('case_back', SX, SX + 0.04, -4.6, 6.4, 0.14, 5.2, 'wood', 'archL')
for k in range(8):
    z = 0.14 + k * 0.66
    box(f'shelf{k}', SX, SX + 0.42, -4.6, 6.4, z, z + 0.04, 'wood', 'archL')
    if k == 7: break
    if k % 2 == 0: box(f'shelflight{k}', SX + 0.36, SX + 0.4, -4.4, 6.2, z + 0.61, z + 0.62, em='shelf')
    y = -4.5
    while y < 6.25:
        r = random.random()
        if r < 0.72:                                                             # a run of books
            n = random.randint(3, 9)
            for b in range(n):
                t = random.uniform(0.028, 0.07); hh = random.uniform(0.36, 0.56); d = random.uniform(0.2, 0.3)
                if y + t > 6.3: break
                box('book', SX + 0.05, SX + 0.05 + d, y, y + t, z + 0.04, z + 0.04 + hh, random.choice(BOOKS), 'props')
                y += t + 0.004
            y += random.uniform(0.02, 0.1)
        elif r < 0.86:                                                           # a stack lying flat
            for b in range(random.randint(2, 4)):
                box('bookflat', SX + 0.06, SX + 0.34, y, y + 0.42, z + 0.04 + b * 0.06, z + 0.095 + b * 0.06, random.choice(BOOKS), 'props')
            y += 0.5
        else:                                                                    # an object: a globe, a model, a pot
            kind = random.choice(('sphere', 'vase', 'box'))
            if kind == 'sphere': blob('keepsake', Vector((SX + 0.22, y + 0.18, z + 0.22)), 0.16, random.choice(('brass', 'chrome', 'copper')), 'props')
            elif kind == 'vase': lathe('keepsake', [(0, 0.34), (0.05, 0.34), (0.04, 0.26), (0.11, 0.12), (0.07, 0), (0, 0)], random.choice(('white', 'copper', 'dark')), 'props', segs=20, closed=False, M=T((SX + 0.22, y + 0.16, z + 0.04)))
            else: box('keepsake', SX + 0.1, SX + 0.34, y + 0.03, y + 0.33, z + 0.04, z + 0.2, random.choice(('crate_o', 'white', 'brass')), 'props', bevel=0.015)
            y += 0.42
for y in (-4.6, -1.85, 0.9, 3.65, 6.4):
    box('case_upright', SX, SX + 0.43, y - 0.025, y + 0.025, 0.14, 5.2, 'wood', 'archL')
# library ladder on a brass rail
tube('ladder_rail', SX + 0.55, 4.9, 0.02, -4.6, 6.4, 'brass', 'archL', n=8)
for dy in (-0.22, 0.22):
    rbox('ladder_side', (0.04, 0.05, 5.0), T((SX + 1.0, 2.6 + dy, 2.45), (0, -0.185, 0)), 'wood_l', 'props')
for k in range(11):
    zz = 0.4 + k * 0.42
    rbox('ladder_rung', (0.05, 0.44, 0.03), T((SX + 1.46 - zz * 0.187, 2.6, zz)), 'wood_l', 'props')

# ================================================================= RIGHT WALL: pictures, a sideboard, two placard screens
RX = WD
box('sideboard', RX - 0.6, RX - 0.02, -3.2, 1.2, 0.12, 0.85, 'wood', 'props', bevel=0.012)
box('sideboard_top', RX - 0.63, RX - 0.02, -3.25, 1.25, 0.85, 0.89, 'wood_l', 'props', bevel=0.008)
for k in range(4):
    box('sideboard_door', RX - 0.615, RX - 0.6, -3.15 + k * 1.09, -2.13 + k * 1.09, 0.17, 0.8, 'wood_l', 'props', bevel=0.006)
lathe('sb_lamp_base', [(0, 0.34), (0.03, 0.34), (0.05, 0.2), (0.1, 0.03), (0.1, 0), (0, 0)], 'brass', 'props', segs=20, closed=False, M=T((RX - 0.32, -2.6, 0.89)))
lathe('sb_lamp_shade', [(0.1, 0.0), (0.17, -0.24), (0.165, -0.24), (0.095, 0.0)], em='lamp', segs=24, M=T((RX - 0.32, -2.6, 1.5)))
glow('sb_lamp_glow', (RX - 0.32, -2.6, 1.36), 55)
lathe('sb_pot', [(0, 0.3), (0.12, 0.3), (0.15, 0.2), (0.1, 0.0), (0, 0)], 'white', 'props', segs=24, closed=False, M=T((RX - 0.32, 0.5, 0.89)))
bm = bmesh.new()
for li in range(22):
    ph = random.uniform(0, 2 * pi); L = random.uniform(0.35, 0.8); lean = random.uniform(0.1, 0.6); wd = random.uniform(0.02, 0.04); prev = None
    for sgi in range(6):
        t = sgi / 5; p = Vector((RX - 0.32 + math.cos(ph) * lean * t * t * L, 0.5 + math.sin(ph) * lean * t * t * L, 1.17 + L * t * (1 - 0.3 * lean * t)))
        d = Vector((math.cos(ph + pi / 2), math.sin(ph + pi / 2), 0)) * (wd * (1 - t ** 2.2) + 0.002)
        cur = (bm.verts.new(p - d), bm.verts.new(p + d))
        if prev: bm.faces.new((prev[0], prev[1], cur[1], cur[0]))
        prev = cur
finish('sb_plant', bm, 'leaf', 'props')
# a salon hang of framed pictures (plain mounts for now) and the two screens
for i, (y, z, w, h) in enumerate(((-3.0, 2.3, 0.7, 0.9), (-2.1, 2.55, 0.5, 0.5), (-2.15, 1.85, 0.55, 0.6), (-1.3, 2.25, 0.8, 1.1)  )):
    box(f'pic_frame{i}', RX - 0.045, RX, y - w / 2, y + w / 2, z - h / 2, z + h / 2, 'frame', 'archR', bevel=0.006)
    box(f'pic_mount{i}', RX - 0.05, RX - 0.045, y - w / 2 + 0.06, y + w / 2 - 0.06, z - h / 2 + 0.06, z + h / 2 - 0.06, 'paper', 'archR')
    box(f'pic_art{i}', RX - 0.053, RX - 0.05, y - w / 4, y + w / 4, z - h / 4, z + h / 4, random.choice(BOOKS), 'archR')
for i, yc in enumerate((1.1, 3.2)):
    box(f'bezel{i}', RX - 0.06, RX, yc - 0.92, yc + 0.92, 1.45, 2.75, 'frame', 'archR', bevel=0.01)
    quad(f'FX_screen{i}', [(RX - 0.065, yc + 0.85, 1.52), (RX - 0.065, yc - 0.85, 1.52), (RX - 0.065, yc - 0.85, 2.68), (RX - 0.065, yc + 0.85, 2.68)], 'lum_screen', fx='screen', uv=True)

pressure_door('door', T((RX - 0.02, 6.0, 0), (0, 0, pi)), 'archR', 'ATRIUM', 'RING LINE  ·  STAIR', 'index.html', w=1.6, h=2.4)

# ================================================================= THE MIDDLE: a rug, two sofas facing each other, armchairs turned to the view
box('rug', -3.3, 3.3, -1.6, 4.6, 0.0, 0.018, 'rug', 'props')
box('rug_border', -3.0, 3.0, -1.3, 4.3, 0.018, 0.021, 'rug2', 'props')
box('rug_field', -2.8, 2.8, -1.1, 4.1, 0.021, 0.024, 'rug', 'props')
def sofa(name, x, y0, y1, face):
    """Low sofa along Y at x, facing +x (face = 1) or -x."""
    b = x - face * 0.5
    box(name + 'base', x - 0.5, x + 0.5, y0, y1, 0.08, 0.22, 'wood', 'props')
    box(name + 'seat', x - 0.47, x + 0.5, y0 + 0.02, y1 - 0.02, 0.22, 0.43, 'linen', 'props', bevel=0.06, seg=3)
    box(name + 'back', min(b, b + face * 0.2), max(b, b + face * 0.2), y0, y1, 0.22, 0.86, 'linen', 'props', bevel=0.07, seg=3)
    for yy in (y0, y1):
        box(name + 'arm', x - 0.5, x + 0.5, yy - 0.09, yy + 0.09, 0.22, 0.62, 'linen', 'props', bevel=0.06, seg=3)
    for k in range(3):
        yy = y0 + (k + 0.5) * (y1 - y0) / 3
        rbox(name + 'cushion', (0.14, 0.5, 0.46), T((b + face * 0.3, yy, 0.62), (0, -face * 0.25, 0)), random.choice(('rug', 'linen', 'rug2')), 'props', bevel=0.05, seg=3)
sofa('sofaL', -2.2, 0.2, 3.0, 1); sofa('sofaR', 2.2, 0.2, 3.0, -1)
box('table_top', -0.75, 0.75, 0.75, 2.45, 0.34, 0.38, 'wood_l', 'props', bevel=0.012)
box('table_slab', -0.6, 0.6, 0.9, 2.3, 0.1, 0.34, 'dark', 'props')
for i in range(3):
    box('tablebook', -0.5, -0.12, 1.05, 1.6, 0.38 + i * 0.045, 0.42 + i * 0.045, random.choice(BOOKS), 'props')
lathe('cup', [(0, 0.09), (0.045, 0.09), (0.04, 0.0), (0, 0.0)], 'white', 'props', segs=16, closed=False, M=T((0.3, 1.2, 0.38)))
lathe('bowl', [(0, 0.02), (0.1, 0.02), (0.18, 0.1), (0.17, 0.1), (0.1, 0.035), (0, 0.035)], 'brass', 'props', segs=24, closed=False, M=T((0.25, 1.95, 0.38)))
def armchair(name, c, yaw):
    M = Matrix.Translation(c) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
    rbox(name + 'seat', (0.74, 0.7, 0.2), M @ T((0, 0, 0.38)), 'leather', 'props', bevel=0.06, seg=3)
    rbox(name + 'back', (0.74, 0.16, 0.7), M @ T((0, -0.33, 0.72), (-0.22, 0, 0)), 'leather', 'props', bevel=0.06, seg=3)
    for d in (-1, 1):
        rbox(name + 'arm', (0.12, 0.66, 0.34), M @ T((d * 0.39, 0, 0.5)), 'leather', 'props', bevel=0.05, seg=3)
    for dx, dy in ((-0.3, -0.26), (0.3, -0.26), (-0.3, 0.26), (0.3, 0.26)):
        rbox(name + 'leg', (0.04, 0.04, 0.28), M @ T((dx, dy, 0.14)), 'wood', 'props')
armchair('chairA', Vector((-1.5, 5.6, 0)), -14); armchair('chairB', Vector((1.3, 5.9, 0)), 12)
lathe('sidetable', [(0, 0.5), (0.24, 0.5), (0.24, 0.47), (0.03, 0.45), (0.03, 0.03), (0.16, 0.0), (0, 0)], 'brass', 'props', segs=24, closed=False, M=T((-0.15, 6.0, 0)))
lathe('sidecup', [(0, 0.09), (0.04, 0.09), (0.035, 0.0), (0, 0.0)], 'white', 'props', segs=16, closed=False, M=T((-0.12, 6.02, 0.5)))
# floor lamp arching over the left sofa
lathe('fl_base', [(0, 0.04), (0.2, 0.04), (0.2, 0), (0, 0)], 'dark', 'props', segs=24, closed=False, M=T((-3.6, 0.0, 0)))
rbox('fl_stem', (0.025, 0.025, 1.9), T((-3.6, 0.0, 0.97)), 'brass', 'props')
rbox('fl_arm', (0.025, 0.025, 1.0), T((-3.2, 0.25, 2.05), (0.0, 1.05, 0.55)), 'brass', 'props')
lathe('fl_shade', [(0.06, 0.0), (0.2, -0.22), (0.195, -0.22), (0.055, 0.0)], em='lamp', segs=24, M=T((-2.8, 0.5, 2.3)))
glow('fl_glow', (-2.8, 0.5, 2.12), 90)
# telescope by the window: brass tube on a timber tripod, pointed at the Moon
TP = Vector((3.6, 6.9, 0)); head = TP + Vector((0, 0, 1.45))
for a in range(3):
    ang = a * 2 * pi / 3 + 0.3; foot = TP + Vector((0.55 * math.cos(ang), 0.55 * math.sin(ang), 0)); q = (head - foot).to_track_quat('Z', 'Y')
    rbox('scope_leg', (0.04, 0.04, (head - foot).length), Matrix.Translation((head + foot) / 2) @ q.to_matrix().to_4x4(), 'wood_l', 'props')
aim = (Vector((-2.0, Y1 + 6, 4.6)) - head).normalized(); Mq = Matrix.Translation(head + Vector((0, 0, 0.1))) @ aim.to_track_quat('Z', 'Y').to_matrix().to_4x4()
lathe('scope_tube', [(0, -0.55), (0.055, -0.55), (0.055, 0.5), (0.075, 0.5), (0.075, 0.62), (0.065, 0.62), (0.065, 0.52), (0, 0.52)], 'brass', 'props', segs=24, closed=False, M=Mq)
lathe('scope_eye', [(0, -0.72), (0.028, -0.72), (0.028, -0.55), (0, -0.55)], 'dark', 'props', segs=16, closed=False, M=Mq)
lathe('scope_mount', [(0, 0.1), (0.06, 0.1), (0.06, 0), (0, 0)], 'dark', 'props', segs=16, closed=False, M=T(head))
# planters either side of the window
for d in (-1, 1):
    c = Vector((d * 5.6, 7.7, 0))
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

# ================================================================= OUTSIDE: the same Earth as the lobby
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
scene['lobby'] = dict(room='about', exposure=1.4, cam=list(CAM_POS), tgt=list(CAM_TGT), close=list(CLOSE_POS), close_tgt=list(CLOSE_TGT), fov=50.0,
                      doors=DOORS, portal=list(PORTAL_C), sun=list(SUN_DIR), backdrop_fov=100, earth=dict(c=list(EARTH_C), r=EARTH_R, u=list(EARTH_U)),
                      floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=1.2), y0=Y0, y1=Y1,
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'about.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
