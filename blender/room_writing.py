"""
Library (Writing). A two-storey reading room in the bow half of the ring tube: bookcases and a gallery down both
sides, one long table, and at the far end the hull, with a tall paned window on the turning Earth. Each piece of
writing is a lit page on a lectern; the featured one stands on the axis in front of the window.
  ./run.sh -b --python room_writing.py      -> writing.blend
"""
import os
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'build_scene.py')).read()
exec(_src.split('# ---- everything above this line is the shared kit')[0], globals())

random.seed(41)
WD = 6.5; Y0, Y1 = -5.0, 14.0; H = 8.6
CAM_POS = Vector((0, -3.6, 1.6))
WIN_W, WIN_Z0, WIN_ZS = 2.6, 1.1, 5.2                     # the window: half width, sill, where the arch springs
_lobby_el = math.atan2(5.65 - 1.65, 26.0 + 4.2)          # elevation of the lobby's camera -> portal direction: same sky in every window
PORTAL_C = Vector((0, Y1, CAM_POS.z + (Y1 - CAM_POS.y) * math.tan(_lobby_el)))
CAM_TGT = Vector((0, Y1, PORTAL_C.z + 0.25))
CLOSE_POS = Vector((0.9, 8.6, 1.65)); CLOSE_TGT = Vector((0.2, Y1 + 4, 4.3))
FLOOR_ROUGH = (0.12, 0.15); FLOOR_IOR = 1.55
GAL_Z, GAL_X = 3.6, WD - 1.3                              # gallery floor; its inner edge
BAYS = [(-4.0 + 3 * k, -1.0 + 3 * k) for k in range(5)]  # bookcase bays between the uprights, entrance -> window
DOOR_BAY = 3                                              # on the left: the way to the Atrium instead of books

mat('wood', (0.2, 0.1, 0.045), 0.42, 0.0, 1.5, 0.25, var=0.1, seams=(0.24, 0, 0))            # walnut
mat('wood_l', (0.42, 0.26, 0.13), 0.5, var=0.1, seams=(0, 0.3, 0))
mat('plaster', (0.3, 0.28, 0.26), 0.7, var=0.05)
mat('runner', (0.045, 0.13, 0.085), 0.95)
mat('runner2', (0.5, 0.4, 0.25), 0.95)
mat('leather', (0.16, 0.07, 0.035), 0.42, var=0.08)
mat('greenlamp', (0.02, 0.16, 0.08), 0.15, 0.0, 1.5, 0.6)
mat('frame', (0.03, 0.03, 0.035), 0.35, 0.8)
mat('paper', (0.75, 0.72, 0.66), 0.8)
mat('navy', (0.03, 0.07, 0.16), 0.35)
BOOKS = []
for i, c in enumerate(((0.45, 0.07, 0.05), (0.06, 0.16, 0.3), (0.55, 0.42, 0.2), (0.1, 0.25, 0.14), (0.6, 0.58, 0.52), (0.08, 0.08, 0.09), (0.5, 0.22, 0.05), (0.25, 0.1, 0.2))):
    mat(f'book{i}', c, 0.6); BOOKS.append(f'book{i}')
EM.update({'lamp': ((1.0, 0.56, 0.24), 9.0), 'shelf': ((1.0, 0.68, 0.4), 2.2), 'cool': ((0.5, 0.82, 1.0), 1.6), 'ring': ((1.0, 0.7, 0.42), 14.0)})
for k in ('lamp', 'shelf', 'cool', 'ring'):
    mat('EM_' + k, (0, 0, 0), 0.5, emis=EM[k][0], estr=EM[k][1])

def rbox(name, size, M, m, grp, bevel=0.0, **kw):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
    return finish(name, bm, m, grp, bevel=bevel, M=M, **kw)
def glow(name, loc, watts, color=(1.0, 0.58, 0.28), r=0.12):
    l = bpy.data.lights.new(name, 'POINT'); l.energy = watts; l.color = color; l.shadow_soft_size = r
    o = bpy.data.objects.new(name, l); COL.objects.link(o); o.location = loc; return o
def torus(name, R, r, M, m=None, grp=None, **kw):
    return lathe(name, [(R + r * math.cos(a * pi / 6), r * math.sin(a * pi / 6)) for a in range(12)], m, grp, segs=64, M=M, **kw)

# ================================================================= SHELL
quad('floor_near', [(-WD, Y0, 0), (WD, Y0, 0), (WD, 3, 0), (-WD, 3, 0)], 'floor', 'floorN')
quad('floor_far', [(-WD, 3, 0), (WD, 3, 0), (WD, Y1, 0), (-WD, Y1, 0)], 'floor', 'floorF')
quad('ceiling', [(-WD, Y0, H), (WD, Y0, H), (WD, Y1, H), (-WD, Y1, H)], 'plaster', 'archC')
quad('backwall', [(-WD, Y0, 0), (WD, Y0, 0), (WD, Y0, H), (-WD, Y0, H)], 'plaster', 'back')
for s in (1, -1):
    g = 'archR' if s > 0 else 'archL'
    quad(f'wall_{g}', [(s * WD, Y0, 0), (s * WD, Y1, 0), (s * WD, Y1, H), (s * WD, Y0, H)], 'plaster', g)
# coffered timber ceiling: a beam over every upright (they case the hull frames), two running the length, light in the coffers
for k, y in enumerate([b[0] for b in BAYS] + [BAYS[-1][1]]):
    box(f'beam{k}', -WD, WD, y - 0.16, y + 0.16, H - 0.6, H, 'wood', 'archC', bevel=0.012)
    box(f'beamlight{k}', -GAL_X + 0.2, GAL_X - 0.2, y - 0.2, y - 0.17, H - 0.08, H - 0.06, em=em_ramp('step', k, y, 1.2, 0.5, 1.0))
for x in (-2.2, 2.2):
    box('beam_long', x - 0.14, x + 0.14, Y0, Y1, H - 0.45, H, 'wood', 'archC', bevel=0.012)

# ================================================================= THE WINDOW (the hull): a tall arch of panes
arch = [(WIN_W * math.cos(pi * i / 48), WIN_ZS + WIN_W * math.sin(pi * i / 48)) for i in range(49)]
def end_piece(name, x0, x1, z0, z1): box(name, x0, x1, Y1 - 0.5, Y1, z0, z1, 'plaster', 'center')
end_piece('end_l', -WD, -WIN_W, 0, H); end_piece('end_r', WIN_W, WD, 0, H); end_piece('end_b', -WIN_W, WIN_W, 0, WIN_Z0)
band('end_t', [(x, H) for x, _ in arch], arch, Y1 - 0.5, Y1, 'plaster', 'center')
band('win_arch', [(x * 1.11, WIN_ZS + (z - WIN_ZS) * 1.11) for x, z in arch], arch, Y1 - 0.58, Y1 - 0.42, 'wood', 'center', bevel=0.012)      # timber architrave
for d in (-1, 1):
    box('win_jamb', d * WIN_W, d * WIN_W * 1.11, Y1 - 0.58, Y1 - 0.42, WIN_Z0 - 0.12, WIN_ZS, 'wood', 'center', bevel=0.012)
box('sill', -WIN_W * 1.11, WIN_W * 1.11, Y1 - 0.85, Y1 - 0.42, WIN_Z0 - 0.12, WIN_Z0, 'wood_l', 'center', bevel=0.015)
# glazing bars: no single pane is wider than 1.3 m (cabin pressure on one 5 m sheet would be about 200 tonnes)
for x in (-1.3, 0.0, 1.3):
    box('mullion', x - 0.03, x + 0.03, Y1 - 0.2, Y1 - 0.1, WIN_Z0, WIN_ZS + math.sqrt(WIN_W ** 2 - x * x), 'frame', 'center')
for z in (3.15, WIN_ZS, 6.5):
    hw = WIN_W if z <= WIN_ZS else math.sqrt(WIN_W ** 2 - (z - WIN_ZS) ** 2)
    box('transom', -hw, hw, Y1 - 0.2, Y1 - 0.1, z - 0.03, z + 0.03, 'frame', 'center')
# either side of the window: panelling to the height of the lower bookcases, a sconce above it
for d_ in (-1, 1):
    x0, x1 = d_ * (WIN_W * 1.11 + 0.25), d_ * GAL_X
    box('end_panel', x0, x1, Y1 - 0.56, Y1 - 0.5, 0.14, 3.44, 'wood', 'center', bevel=0.01)
    box('end_plinth', x0, x1, Y1 - 0.6, Y1 - 0.5, 0, 0.14, 'wood', 'center')
    box('end_cornice', x0, x1, Y1 - 0.64, Y1 - 0.5, 3.44, 3.58, 'wood', 'center', bevel=0.015)
    for k in range(3):
        xa = x0 + (x1 - x0) * (k + 0.12) / 3; xb = x0 + (x1 - x0) * (k + 0.88) / 3
        box('end_inset', xa, xb, Y1 - 0.585, Y1 - 0.56, 0.5, 3.1, 'wood_l', 'center', bevel=0.008)
    xs = (x0 + x1) / 2
    box('sconce_arm', xs - 0.03, xs + 0.03, Y1 - 0.72, Y1 - 0.5, 4.85, 4.9, 'brass', 'center')
    lathe('sconce', [(0.05, 0.0), (0.13, 0.3), (0.125, 0.3), (0.045, 0.0)], em='lamp', segs=20, M=T((xs, Y1 - 0.74, 4.9)))
    glow(f'sconce_glow{d_}', (xs, Y1 - 0.8, 5.1), 40)
box('win_cove', -WIN_W + 0.1, WIN_W - 0.1, Y1 - 0.46, Y1 - 0.43, WIN_Z0 - 0.16, WIN_Z0 - 0.145, em='cool')

# ================================================================= BOOKCASES: two tiers each side, a gallery between
def books(SX, s, y0, y1, z, grp, deep=0.3):
    """Fill one shelf (books standing, a few lying, the odd keepsake). s: +1 right wall, -1 left; SX: the wall."""
    f = lambda a, b: (SX - s * a, SX - s * b)                    # distances from the wall -> x range
    y = y0 + 0.04
    while y < y1 - 0.1:
        r = random.random()
        if r < 0.8:
            for b in range(random.randint(4, 11)):
                t = random.uniform(0.028, 0.07); hh = random.uniform(0.34, 0.5); d = random.uniform(0.2, deep)
                if y + t > y1 - 0.04: break
                box('book', *f(0.05, 0.05 + d), y, y + t, z, z + hh, random.choice(BOOKS), grp); y += t + 0.004
            y += random.uniform(0.02, 0.12)
        elif r < 0.93:
            for b in range(random.randint(2, 4)):
                box('bookflat', *f(0.06, 0.34), y, y + 0.42, z + b * 0.06, z + 0.055 + b * 0.06, random.choice(BOOKS), grp)
            y += 0.5
        else:
            blob('keepsake', Vector((SX - s * 0.22, y + 0.18, z + 0.17)), 0.15, random.choice(('brass', 'chrome', 'copper', 'white')), grp); y += 0.42
for s in (1, -1):
    g = 'archR' if s > 0 else 'archL'; SX = s * WD; X = lambda a: SX - s * a      # X(a): a metres in from this wall
    for tier, z0 in enumerate((0.14, GAL_Z + 0.12)):
        for bi, (y0, y1) in enumerate(BAYS):
            if s < 0 and tier == 0 and bi == DOOR_BAY: continue
            box(f'case_back{tier}{bi}', X(0), X(0.04), y0, y1, z0, z0 + 3.3, 'wood', g)
            for k in range(6):
                z = z0 + k * 0.62
                box(f'shelf{tier}{bi}{k}', X(0), X(0.42), y0, y1, z, z + 0.04, 'wood', g)
                if k == 5: break
                if k in (1, 3): box('shelflight', X(0.36), X(0.4), y0 + 0.15, y1 - 0.15, z + 0.57, z + 0.58, em='shelf')
                books(SX, s, y0 + 0.03, y1 - 0.03, z + 0.04, g)
        for y in [b[0] for b in BAYS] + [BAYS[-1][1]]:                              # uprights, as pilasters
            box(f'upright{tier}', X(0), X(0.5), y - 0.11, y + 0.11, z0 - (0.14 if tier == 0 else 0), z0 + 3.42, 'wood', g, bevel=0.012)
        box(f'cornice{tier}', X(0), X(0.56), BAYS[0][0] - 0.11, BAYS[-1][1] + 0.11, z0 + 3.3, z0 + 3.44, 'wood', g, bevel=0.015)
    box('plinth', X(0), X(0.46), BAYS[0][0], BAYS[-1][1], 0, 0.14, 'wood', g)
    # the gallery: a walkway in front of the upper tier, brass rail, a warm line under its edge
    box('gallery', X(0), X(1.3), Y0, Y1 - 0.5, GAL_Z - 0.16, GAL_Z, 'wood', g, bevel=0.01)
    box('gallery_edge', X(1.3), X(1.36), Y0, Y1 - 0.5, GAL_Z - 0.3, GAL_Z + 0.04, 'wood_l', g, bevel=0.01)
    box('gallery_light', X(1.2), X(1.26), BAYS[0][0], BAYS[-1][1], GAL_Z - 0.175, GAL_Z - 0.16, em='shelf')
    for k in range(int((Y1 - 0.5 - Y0) / 1.5) + 1):
        y = Y0 + 0.1 + k * 1.5
        rbox('rail_post', (0.03, 0.03, 1.0), T((X(1.33), y, GAL_Z + 0.5)), 'brass', g)
    for z in (GAL_Z + 0.55, GAL_Z + 1.02):
        tube('rail', X(1.33), z, 0.018 if z < GAL_Z + 1 else 0.026, Y0, Y1 - 0.5, 'brass', g, n=8)
    # a ladder on a brass rail along the lower tier
    ly = 0.3 if s > 0 else -2.2
    tube('ladder_rail', X(0.62), 3.3, 0.02, BAYS[0][0], BAYS[-1][1], 'brass', g, n=8)
    for dy in (-0.22, 0.22):
        rbox('ladder_side', (0.04, 0.05, 3.4), T((X(1.0), ly + dy, 1.65), (0, s * 0.2, 0)), 'wood_l', 'props')
    for k in range(7):
        zz = 0.4 + k * 0.42
        rbox('ladder_rung', (0.05, 0.44, 0.03), T((X(1.34 - zz * 0.2), ly, zz)), 'wood_l', 'props')
pressure_door('door', T((-WD + 0.02, sum(BAYS[DOOR_BAY]) / 2, 0)), 'archL', 'ATRIUM', 'SPINWARD  ·  MIDWAY', 'lobby', w=1.6, h=2.4)

# ================================================================= THE NAVE: a runner, one long table, lamps, chairs
box('runner', -1.9, 1.9, -3.4, 11.6, 0.0, 0.016, 'runner', 'props')
box('runner_border', -1.7, 1.7, -3.2, 11.4, 0.016, 0.019, 'runner2', 'props')
box('runner_field', -1.55, 1.55, -3.05, 11.25, 0.019, 0.022, 'runner', 'props')
TY0, TY1, TW = 0.6, 8.6, 0.62
box('table_top', -TW, TW, TY0, TY1, 0.72, 0.77, 'wood_l', 'props', bevel=0.012)
box('table_inlay', -TW + 0.12, TW - 0.12, TY0 + 0.12, TY1 - 0.12, 0.77, 0.773, 'leather', 'props')
box('table_apron', -TW + 0.08, TW - 0.08, TY0 + 0.08, TY1 - 0.08, 0.6, 0.72, 'wood', 'props')
for y in (TY0 + 0.5, (TY0 + TY1) / 2, TY1 - 0.5):
    box('table_trestle', -TW + 0.1, TW - 0.1, y - 0.05, y + 0.05, 0.06, 0.6, 'wood', 'props', bevel=0.01)
    box('table_foot', -TW - 0.05, TW + 0.05, y - 0.08, y + 0.08, 0.0, 0.06, 'wood', 'props', bevel=0.01)
for k, y in enumerate((1.6, 3.6, 5.6, 7.6)):                                         # reading lamps: brass, green glass
    lathe('lamp_base', [(0, 0.03), (0.09, 0.03), (0.09, 0), (0, 0)], 'brass', 'props', segs=20, closed=False, M=T((0, y, 0.773)))
    rbox('lamp_stem', (0.018, 0.018, 0.34), T((0, y, 0.95)), 'brass', 'props')
    rbox('lamp_shade', (0.5, 0.16, 0.07), T((0, y, 1.15)), 'greenlamp', 'props', bevel=0.03, seg=3)
    box('lamp_light', -0.22, 0.22, y - 0.05, y + 0.05, 1.108, 1.113, em='lamp')
    glow(f'lamp_glow{k}', (0, y, 1.06), 22)
    for b in range(random.randint(1, 3)):                                            # reading left on the table
        bx = random.choice((-1, 1)) * random.uniform(0.2, 0.36); by = y + random.uniform(0.45, 1.3)
        rbox('tablebook', (0.2, 0.28, 0.035), T((bx, by, 0.791 + b * 0.036), (0, 0, random.uniform(-0.5, 0.5))), random.choice(BOOKS), 'props')
def chair(name, x, y, face):
    M = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(0 if face > 0 else pi, 4, 'Z')    # the sitter looks along +x (face = 1) or -x
    rbox(name + 'seat', (0.44, 0.46, 0.06), M @ T((0, 0, 0.45)), 'leather', 'props', bevel=0.02)
    rbox(name + 'back', (0.05, 0.44, 0.5), M @ T((-0.22, 0, 0.78), (0, -0.12, 0)), 'wood', 'props', bevel=0.015)
    for dx, dy in ((-0.19, -0.2), (0.19, -0.2), (-0.19, 0.2), (0.19, 0.2)):
        rbox(name + 'leg', (0.035, 0.035, 0.42), M @ T((dx, dy, 0.21)), 'wood', 'props')
for y in (1.6, 3.6, 5.6, 7.6):
    for d in (-1, 1):
        chair('chair', d * (TW + 0.42 + random.uniform(0, 0.12)), y + random.uniform(-0.1, 0.1), -d)
# three ring lights hung over the table, high enough to leave the window clear
for k, y in enumerate((1.6, 5.1, 8.6)):
    torus(f'pendant{k}', 1.05, 0.035, T((0, y, 6.3)), 'brass', 'archC')
    torus(f'pendant_light{k}', 1.05, 0.02, T((0, y, 6.26)), em='ring')
    for a in range(3):
        ang = a * 2 * pi / 3 + 0.5; rbox('pendant_rod', (0.012, 0.012, H - 6.3), T((1.05 * math.cos(ang), y + 1.05 * math.sin(ang), (H + 6.3) / 2)), 'brass', 'archC')

# ================================================================= THE WRITING: lit pages on lecterns
SCREENS = []
def lectern(c, face, w, h, lean=0.62, post=True):
    """A page on a stand. c: centre of the page; face: the horizontal direction it looks; lean: radians back from vertical."""
    f = Vector((face[0], face[1], 0)).normalized(); left = Vector((f.y, -f.x, 0))        # the reader's left
    up = Vector((0, 0, math.cos(lean))) - f * math.sin(lean); n = f * math.cos(lean) + Vector((0, 0, math.sin(lean))); c = Vector(c)
    P = lambda a, b, d=0.0: tuple(c + left * a + up * b + n * d)
    i = len(SCREENS); name = f'FX_screen{i}'; SCREENS.append(name)
    quad(name, [P(w / 2, -h / 2, 0.012), P(-w / 2, -h / 2, 0.012), P(-w / 2, h / 2, 0.012), P(w / 2, h / 2, 0.012)], 'lum_screen', fx='screen', uv=True)
    M = Matrix((( -left.x, up.x, n.x, c.x), (-left.y, up.y, n.y, c.y), (-left.z, up.z, n.z, c.z), (0, 0, 0, 1)))
    rbox(f'lectern_board{i}', (w + 0.08, h + 0.08, 0.03), M @ T((0, 0, -0.012)), 'wood', 'props', bevel=0.008)
    rbox(f'lectern_lip{i}', (w + 0.08, 0.03, 0.05), M @ T((0, -h / 2 - 0.04, 0.02)), 'brass', 'props')
    if post:
        foot = c - n * 0.06; foot.z = 0
        lathe(f'lectern_post{i}', [(0, c.z - 0.05), (0.03, c.z - 0.05), (0.03, 0.05), (0.2, 0.02), (0.2, 0), (0, 0)], 'brass', 'props', segs=24, closed=False, M=T(foot - f * 0.05))
for y in (2.2, 6.6):                                                                 # four along the nave, turned a little towards whoever walks in
    for d in (-1, 1):
        lectern((d * 2.75, y, 1.28), (-d * 0.85, -0.5), 0.62, 0.44)
# the featured piece: a larger page on a dais in front of the window
lathe('dais', [(0, 0.3), (1.35, 0.3), (1.35, 0.15), (1.7, 0.15), (1.7, 0), (0, 0)], 'wood', 'center', segs=64, closed=False, M=T((0, 11.4, 0)))
lectern((0, 11.3, 1.72), (0, -1), 1.0, 0.7, lean=0.5, post=False)
lathe('feature_post', [(0, 1.42), (0.05, 1.42), (0.05, 0.1), (0.3, 0.04), (0.3, 0), (0, 0)], 'brass', 'center', segs=32, closed=False, M=T((0, 11.55, 0.3)))

# ================================================================= BY THE WINDOW: a globe, a chair to read in
GC = Vector((4.1, 12.2, 1.05))
blob('globe', GC, 0.52, 'navy', 'props')
torus('globe_meridian', 0.56, 0.015, Matrix.Translation(GC) @ Matrix.Rotation(pi / 2, 4, 'X') @ Matrix.Rotation(0.41, 4, 'Y'), 'brass', 'props')
torus('globe_horizon', 0.62, 0.02, T(GC), 'wood_l', 'props')
for a in range(4):
    ang = a * pi / 2 + 0.4; rbox('globe_leg', (0.04, 0.04, 1.05), T((GC.x + 0.6 * math.cos(ang), GC.y + 0.6 * math.sin(ang), 0.52)), 'wood', 'props')
AC = Matrix.Translation((-4.0, 12.0, 0)) @ Matrix.Rotation(math.radians(-25), 4, 'Z')
rbox('arm_seat', (0.74, 0.7, 0.2), AC @ T((0, 0, 0.38)), 'leather', 'props', bevel=0.06, seg=3)
rbox('arm_back', (0.74, 0.16, 0.75), AC @ T((0, -0.33, 0.74), (-0.22, 0, 0)), 'leather', 'props', bevel=0.06, seg=3)
for d in (-1, 1):
    rbox('arm_arm', (0.12, 0.66, 0.34), AC @ T((d * 0.39, 0, 0.5)), 'leather', 'props', bevel=0.05, seg=3)
lathe('fl_base', [(0, 0.04), (0.18, 0.04), (0.18, 0), (0, 0)], 'dark', 'props', segs=24, closed=False, M=T((-4.9, 11.6, 0)))
rbox('fl_stem', (0.025, 0.025, 1.6), T((-4.9, 11.6, 0.82)), 'brass', 'props')
lathe('fl_shade', [(0.07, 0.0), (0.2, -0.24), (0.195, -0.24), (0.065, 0.0)], em='lamp', segs=24, M=T((-4.9, 11.6, 1.84)))
glow('fl_glow', (-4.9, 11.6, 1.68), 60)

# ================================================================= OUTSIDE: the same Earth as the Atrium and the Lounge
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
scene['lobby'] = dict(room='writing', exposure=1.3, cam=list(CAM_POS), tgt=list(CAM_TGT), close=list(CLOSE_POS), close_tgt=list(CLOSE_TGT), fov=50.0,
                      doors=DOORS, screens=SCREENS, portal=list(PORTAL_C), sun=list(SUN_DIR), backdrop_fov=100,
                      # the ring's spin, as in the Atrium (see build_scene.py); half: half-size of the window the sun shines through
                      spin=dict(axis=[0.0, 1.0, 0.0], period=120.0, sun_e=[sun.energy * c for c in sun.color], half=4.8), earth=dict(c=list(EARTH_C), r=EARTH_R, u=list(EARTH_U)),
                      floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=1.2), y0=Y0, y1=Y1,
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'writing.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
