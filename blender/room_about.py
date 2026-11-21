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

mat('wood_d', (0.09, 0.045, 0.022), 0.38, 0.0, 1.5, 0.3, var=0.08); mat('leather_g', (0.05, 0.12, 0.08), 0.45, var=0.06); mat('greenlamp', (0.02, 0.2, 0.09), 0.08, 0.0, 1.5, 1.0)
mat('gilt', (0.95, 0.7, 0.32), 0.25, 1.0); mat('marble', (0.78, 0.76, 0.72), 0.25, var=0.05); mat('runner3', (0.3, 0.07, 0.05), 0.95); mat('navy', (0.03, 0.07, 0.16), 0.35)
mat('drape', (0.1, 0.035, 0.03), 0.9); mat('glassware', (0.16, 0.19, 0.22), 0.03, 0.0, 1.5, 1.0); mat('whisky', (0.55, 0.25, 0.05), 0.1, 0.0, 1.4, 1.0)
# Shared reading furniture (bookcase bays, ladder, wing chair, stacks ...).
exec(open(os.path.join(_here, 'assets_reading.py')).read(), globals())

def rbox(name, size, M, m, grp, bevel=0.0, **kw):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
    return finish(name, bm, m, grp, bevel=bevel, M=M, **kw)
def glow(name, loc, watts, color=(1.0, 0.58, 0.28), r=0.12):
    l = bpy.data.lights.new(name, 'POINT'); l.energy = watts; l.color = color; l.shadow_soft_size = r
    o = bpy.data.objects.new(name, l); COL.objects.link(o); o.location = loc; return o

# ================================================================= ASSETS of the Lounge
def a_wainscot(M=I4, grp='props', L=4.0, hgt=1.25):
    """Panelling along a wall: built on the plane x = 0 reaching +x into the room, running 0..L in y."""
    box('wains', 0, 0.03, 0, L, 0, hgt, 'wood', grp, M=M); box('wains_skirt', 0, 0.06, 0, L, 0, 0.16, 'wood_l', grp, bevel=0.006, M=M)
    moulding('wains_rail', [(0, hgt), (0.07, hgt), (0.09, hgt + 0.03), (0.06, hgt + 0.07), (0, hgt + 0.07)], 0, L, 'wood_l', grp, M=M)
    n = max(1, int(round(L / 0.95)))
    for k in range(n):
        a, b = L * (k + 0.1) / n, L * (k + 0.9) / n
        box('wains_field', 0.03, 0.04, a, b, 0.3, hgt - 0.14, 'wood_d', grp, M=M); box('wains_raise', 0.04, 0.052, a + 0.07, b - 0.07, 0.37, hgt - 0.21, 'wood_l', grp, bevel=0.01, M=M)
def a_drape(M=I4, grp='props', w=0.9, h=5.6):
    """A heavy curtain gathered to one side: folds running top to bottom, a brass pole ring row, a tie-back."""
    bm = bmesh.new(); n = 28; rows = []
    for zi in range(9):
        z = h * zi / 8; pinch = 1 - 0.45 * math.exp(-((z - h * 0.42) / 0.5) ** 2)
        rows.append([bm.verts.new(((i / n - 0.5) * w * pinch, 0.07 * math.sin(i * 1.9) * (0.6 + 0.4 * pinch), z)) for i in range(n + 1)])
    for a, b in zip(rows, rows[1:]):
        for i in range(n): bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    for f in bm.faces: f.smooth = True
    finish('drape', bm, 'drape', grp, M=M)
    torus('drape_tie', w * 0.3, 0.015, M @ T((0, 0, h * 0.42)), 'gilt', grp, segs=24)
def a_sofa_trim(M=I4, grp='props', L=2.8):
    """What the sofas were missing (origin at the middle of the seat front, sofa along y): turned feet, a welt along the seat, a throw over one arm."""
    for y in (-L / 2 + 0.12, 0, L / 2 - 0.12):
        for x in (-0.42, 0.42): turned('sofa_foot', 0.1, 0.03, 'wood', grp, M=M @ T((x, y, 0)), segs=10)
    rod('sofa_welt', (0.5, -L / 2, 0.43), (0.5, L / 2, 0.43), 0.008, 'rug2', grp, M=M)
    # A single woven panel lies over the end arm, sags at its free sides, and rolls over the nose.
    path = ((-.285, .638, 1), (-.22, .636, 1), (-.12, .636, 1), (.035, .634, 1),
            (.18, .633, 1), (.31, .636, 1), (.411, .637, 1), (.455, .632, .99),
            (.483, .615, .92), (.504, .588, .76), (.516, .552, .55), (.516, .502, .32),
            (.514, .451, .16), (.512, .398, .07), (.511, .352, 0))
    widths = (-1, -.95, -.90, -.82, -.775, -.66, -.50, -.29, -.12, .06,
              .23, .39, .54, .70, .78, .825, .91, .96, 1)
    face, lining = [], []
    for i, (x, z, support) in enumerate(path):
        xa, za, _ = path[max(0, i - 1)]
        xb, zb, _ = path[min(len(path) - 1, i + 1)]
        n = Vector((za - zb, 0, xb - xa)).normalized()
        s = i / (len(path) - 1)
        row, inner = [], []
        for v in widths:
            free = max(0, (abs(v) - .26) / .74)
            sag = .119 * support * free**1.55
            folds = (math.sin(9.0 * v + .95 * s) + .38 * math.sin(17 * v - 1.6 * s))
            lift = folds * (.0025 + .010 * free + .002 * (1 - support))
            hem = (1 - support)**2 * (.011 * v + .008 * math.sin(9 * v + s))
            p = Vector((x + .014 * v * v * max(0, 1 - 5*s), L / 2 + (.219 + .016*s) * v + .006*s,
                        z - sag + hem)) + n * lift
            row.append(p)
            inner.append(p - n * (.0045 if abs(v) >= .95 or i in (0, len(path) - 1) else .0028))
        face.append(row)
        lining.append(inner)
    bm = bmesh.new()
    _reading_patch(bm, face, accent_cols=(3, 14))
    _reading_patch(bm, lining, accent_cols=(3, 14))
    for i in (0, -1):
        _reading_patch(bm, [face[i], lining[i]], smooth=False)
        _reading_patch(bm, [[a[i], b[i]] for a, b in zip(face, lining)], smooth=False)
    throw = finish('sofa_throw', bm, 'rug', grp, M=M)
    throw.data.materials.append(MAT['rug2'])
def a_drinks(M=I4, grp='props'):
    """A brass tray with a decanter and two glasses."""
    lathe('tray', [(0, 0.012), (0.2, 0.012), (0.215, 0.03), (0.22, 0.03), (0.2, 0), (0, 0)], 'brass', grp, segs=32, closed=False, M=M)
    lathe('decanter', [(0, 0.012), (0.055, 0.012), (0.065, 0.03), (0.06, 0.13), (0.02, 0.17), (0.018, 0.22), (0.028, 0.23), (0.0, 0.23)], 'glassware', grp, segs=20, closed=False, M=M @ T((-0.05, 0.03, 0)))
    lathe('decanter_w', [(0, 0.02), (0.05, 0.02), (0.057, 0.035), (0.054, 0.1), (0, 0.1)], 'whisky', grp, segs=20, closed=False, M=M @ T((-0.05, 0.03, 0)))
    blob('stopper', M @ Vector((-0.05, 0.03, 0.255)), 0.025, 'glassware', grp)
    for x, y in ((0.09, -0.06), (0.1, 0.07)): lathe('glass', [(0, 0.014), (0.032, 0.014), (0.036, 0.09), (0.033, 0.09), (0.03, 0.02), (0, 0.02)], 'glassware', grp, segs=16, closed=False, M=M @ T((x, y, 0)))
def a_frame(M=I4, grp='props', w=0.7, h=0.9):
    """A picture in a gilt frame under a brass picture light (hung on the plane x = 0, facing -x)."""
    box('pic_gilt', -0.05, 0, -w / 2 - 0.05, w / 2 + 0.05, -h / 2 - 0.05, h / 2 + 0.05, 'gilt', grp, bevel=0.012, M=M); box('pic_inner', -0.058, -0.05, -w / 2, w / 2, -h / 2, h / 2, 'frame', grp, M=M)
    box('pic_mount', -0.062, -0.058, -w / 2 + 0.03, w / 2 - 0.03, -h / 2 + 0.03, h / 2 - 0.03, 'paper', grp, M=M); box('pic_art', -0.065, -0.062, -w / 4, w / 4, -h / 4, h / 4, random.choice(BOOKS), grp, M=M)
    rod('pic_light', (-0.16, -w * 0.3, h / 2 + 0.14), (-0.16, w * 0.3, h / 2 + 0.14), 0.014, 'brass', grp, M=M); rod('pic_arm', (0, 0, h / 2 + 0.1), (-0.16, 0, h / 2 + 0.14), 0.006, 'brass', grp, M=M)
exec(open(os.path.join(_here, 'assets_lounge.py')).read(), globals())
ASSETS = READING_ASSETS.copy()
ASSETS.update(wainscot=a_wainscot, drape=a_drape, sofa_trim=a_sofa_trim, drinks=a_drinks, frame=a_frame,
              coffee_table=a_coffee_table, telescope=a_telescope, sideboard=a_sideboard, sofa_body=a_sofa_body)
bench(ASSETS)

# ================================================================= SHELL
quad('floor_near', [(-WD, Y0, 0), (WD, Y0, 0), (WD, 2, 0), (-WD, 2, 0)], 'floor', 'floorN')
quad('floor_far', [(-WD, 2, 0), (WD, 2, 0), (WD, Y1, 0), (-WD, Y1, 0)], 'floor', 'floorF')
quad('ceiling', [(-WD, Y0, H), (WD, Y0, H), (WD, Y1, H), (-WD, Y1, H)], 'plaster', 'archC')
quad('backwall', [(-WD, Y0, 0), (WD, Y0, 0), (WD, Y0, H), (-WD, Y0, H)], 'plaster', 'back')
for s in (1, -1):
    g = 'archR' if s > 0 else 'archL'
    quad(f'wall_{g}', [(s * WD, Y0, 0), (s * WD, Y1, 0), (s * WD, Y1, H), (s * WD, Y0, H)], 'plaster', g)
    box(f'skirt_{g}', s * (WD - 0.03), s * WD, Y0, Y1, 0, 0.14, 'wood', g)
# ---- Timber ceiling: beams, slats and concealed lighting
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
for dd in (-1, 1): a_drape(T((dd * (WIN_W + 0.35), Y1 - 0.7, 0.3)), 'center', w=1.0, h=H - 0.9)
rod('drape_pole', (-WD + 0.2, Y1 - 0.7, H - 0.55), (WD - 0.2, Y1 - 0.7, H - 0.55), 0.025, 'brass', 'center')
box('win_cove', -WIN_W + 0.1, WIN_W - 0.1, Y1 - 0.5, Y1 - 0.46, WIN_Z0 - 0.1, WIN_Z0 - 0.085, em='cool')      # faint cool line under the sill

# ================================================================= LEFT WALL: the library of a life (four bookcase bays, a ladder)
SX = -WD
for k in range(4): a_bay(T((SX, -4.6 + k * 2.75, 0)), 'archL', -1, 0, L=2.75, rows=8)
tube('ladder_rail', SX + 0.62, 4.75, 0.02, -4.6, 6.4, 'brass', 'archL', n=8)
a_ladder(T((SX + 1.6, 2.6, 0)), 'props', h=4.85)

# ================================================================= RIGHT WALL: pictures, a sideboard, two placard screens
RX = WD
a_sideboard(T((RX, -1.0, 0)))
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
# ---- Framed pictures, wall panelling and two placards
for y, z, w, h in ((-3.0, 2.45, 0.7, 0.9), (-2.05, 2.75, 0.5, 0.5), (-2.1, 1.95, 0.55, 0.6), (-1.2, 2.4, 0.8, 1.1)):
    a_frame(T((RX, y, z)), 'archR', w, h)
a_wainscot(T((RX, 5.0, 0)) @ Matrix.Rotation(pi, 4, 'Z'), 'archR', L=11.0); a_wainscot(T((RX, Y1 - 0.55, 0)) @ Matrix.Rotation(pi, 4, 'Z'), 'archR', L=1.45)
a_wainscot(T((WD, Y0, 0)) @ Matrix.Rotation(pi / 2, 4, 'Z'), 'back', L=2 * WD)
a_drinks(T((RX - 0.32, -1.0, 0.89))); a_stack(T((RX - 0.3, -0.2, 0.89), (0, 0, 0.3)), n=3)
for i, yc in enumerate((1.1, 3.2)):
    box(f'bezel{i}', RX - 0.06, RX, yc - 0.92, yc + 0.92, 1.45, 2.75, 'frame', 'archR', bevel=0.01)
    quad(f'FX_screen{i}', [(RX - 0.065, yc + 0.85, 1.52), (RX - 0.065, yc - 0.85, 1.52), (RX - 0.065, yc - 0.85, 2.68), (RX - 0.065, yc + 0.85, 2.68)], 'lum_screen', fx='screen', uv=True)

pressure_door('door', T((RX - 0.02, 6.0, 0), (0, 0, pi)), 'archR', 'ATRIUM', 'RING LINE  ·  STAIR', 'lobby', w=1.6, h=2.4)

# ================================================================= THE MIDDLE: a rug, two sofas facing each other, armchairs turned to the view
box('rug', -3.3, 3.3, -1.6, 4.6, 0.0, 0.018, 'rug', 'props')
box('rug_border', -3.0, 3.0, -1.3, 4.3, 0.018, 0.021, 'rug2', 'props')
box('rug_field', -2.8, 2.8, -1.1, 4.1, 0.021, 0.024, 'rug', 'props')
a_sofa_body(T((-2.2, 1.6, 0)), name='sofaL')
a_sofa_body(T((2.2, 1.6, 0)), name='sofaR', face=-1)
a_sofa_trim(T((-2.2, 1.6, 0))); a_sofa_trim(T((2.2, 1.6, 0)) @ Matrix.Rotation(pi, 4, 'Z'))
for a, b in ((3.12, 3.06), (2.94, 2.9)):
    for dd in (-1, 1): box('rug_line', dd * a, dd * b, -1.5, 4.5, 0.021, 0.0245, 'rug2', 'props')
a_coffee_table(T((0, 1.6, 0)))
a_stack(T((-0.31, 1.33, 0.38), (0, 0, 0.15)), n=4); a_openbook(T((0.05, 1.95, 0.38), (0, 0, 0.4))); a_drinks(T((0.38, 1.25, 0.38)))
def armchair(name, c, yaw):
    M = Matrix.Translation(c) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
    rbox(name + 'seat', (0.74, 0.7, 0.2), M @ T((0, 0, 0.38)), 'leather', 'props', bevel=0.06, seg=3)
    rbox(name + 'back', (0.74, 0.16, 0.7), M @ T((0, -0.33, 0.72), (-0.22, 0, 0)), 'leather', 'props', bevel=0.06, seg=3)
    for d in (-1, 1):
        rbox(name + 'arm', (0.12, 0.66, 0.34), M @ T((d * 0.39, 0, 0.5)), 'leather', 'props', bevel=0.05, seg=3)
    for dx, dy in ((-0.3, -0.26), (0.3, -0.26), (-0.3, 0.26), (0.3, 0.26)):
        rbox(name + 'leg', (0.04, 0.04, 0.28), M @ T((dx, dy, 0.14)), 'wood', 'props')
a_armchair(T((-1.9, 5.7, 0)) @ Matrix.Rotation(math.radians(-14), 4, 'Z')); a_armchair(T((1.3, 6.0, 0)) @ Matrix.Rotation(math.radians(12), 4, 'Z'))
# ---- Arched floor lamp over the left sofa
lathe('fl_base', [(0, 0.04), (0.2, 0.04), (0.2, 0), (0, 0)], 'dark', 'props', segs=24, closed=False, M=T((-3.6, 0.0, 0)))
rbox('fl_stem', (0.025, 0.025, 1.9), T((-3.6, 0.0, 0.97)), 'brass', 'props')
rbox('fl_arm', (0.025, 0.025, 1.0), T((-3.2, 0.25, 2.05), (0.0, 1.05, 0.55)), 'brass', 'props')
lathe('fl_shade', [(0.06, 0.0), (0.2, -0.22), (0.195, -0.22), (0.055, 0.0)], em='lamp', segs=24, M=T((-2.8, 0.5, 2.3)))
glow('fl_glow', (-2.8, 0.5, 2.12), 90)
# ---- Brass telescope and tripod by the window
scope_M = T((3.6, 6.9, 0))
a_telescope(scope_M, target=scope_M.inverted() @ Vector((-2.0, Y1 + 6, 4.6)))
# ---- Window planters
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
                      doors=DOORS, screens=['FX_screen0', 'FX_screen1'],
                      focus=[dict(c=[-0.31, 1.33, 0.5], r=0.95, dir=[0.15, -0.8, 0.58])],      # the books on the table: the room's one exhibit
                      portal=list(PORTAL_C), sun=list(SUN_DIR), backdrop_fov=100,
                      # the ring's spin, as in the Atrium (see build_scene.py); half: half-size of the window the sun shines through
                      spin=dict(axis=[0.0, 1.0, 0.0], period=120.0, sun_e=[sun.energy * c for c in sun.color], half=WIN_W + 1.5), earth=dict(c=list(EARTH_C), r=EARTH_R, u=list(EARTH_U)),
                      floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=1.2), y0=Y0, y1=Y1,
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'about.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
