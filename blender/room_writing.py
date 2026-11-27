"""
Library (Writing). A two-storey reading room in the bow half of the ring tube: bookcases and a gallery down both
sides, one long table, and at the far end the hull, with a tall paned window on the turning Earth. The writing is
asked for at a terminal on the table; a drone fetches the volume from its shelf.
  ./run.sh -b --python room_writing.py                 -> writing.blend
  ASSET=<name> ./run.sh -b --python room_writing.py    -> one asset alone in a studio: asset_<name>.png (see ASSETS)
The room is assembled from the assets below; each is a function that builds itself at a placement M.
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
TY0, TY1, TW, TZ = 0.6, 8.6, 0.62, 0.77                   # the reading table: its ends, half width, top

mat('wood', (0.2, 0.1, 0.045), 0.42, 0.0, 1.5, 0.25, var=0.1, seams=(0.24, 0, 0))            # walnut
mat('wood_l', (0.42, 0.26, 0.13), 0.5, var=0.1, seams=(0, 0.3, 0))
mat('wood_d', (0.09, 0.045, 0.022), 0.38, 0.0, 1.5, 0.3, var=0.08)                           # the darkest mouldings
mat('plaster', (0.3, 0.28, 0.26), 0.7, var=0.05)
mat('runner', (0.045, 0.13, 0.085), 0.95); mat('runner2', (0.5, 0.4, 0.25), 0.95); mat('runner3', (0.3, 0.07, 0.05), 0.95)
mat('leather', (0.16, 0.07, 0.035), 0.42, var=0.08); mat('leather_g', (0.05, 0.12, 0.08), 0.45, var=0.06)
mat('greenlamp', (0.02, 0.2, 0.09), 0.08, 0.0, 1.5, 1.0)
mat('frame', (0.03, 0.03, 0.035), 0.35, 0.8)
mat('paper', (0.75, 0.72, 0.66), 0.8)
mat('navy', (0.03, 0.07, 0.16), 0.35)
mat('marble', (0.78, 0.76, 0.72), 0.25, var=0.05)
mat('gilt', (0.95, 0.7, 0.32), 0.25, 1.0)
BOOKS = []
for i, c in enumerate(((0.45, 0.07, 0.05), (0.06, 0.16, 0.3), (0.55, 0.42, 0.2), (0.1, 0.25, 0.14), (0.6, 0.58, 0.52), (0.08, 0.08, 0.09), (0.5, 0.22, 0.05), (0.25, 0.1, 0.2))):
    mat(f'book{i}', c, 0.6); BOOKS.append(f'book{i}')
EM.update({'lamp': ((1.0, 0.56, 0.24), 9.0), 'shelf': ((1.0, 0.68, 0.4), 2.2), 'cool': ((0.5, 0.82, 1.0), 1.6), 'ring': ((1.0, 0.7, 0.42), 14.0)})
for k in ('lamp', 'shelf', 'cool', 'ring'):
    mat('EM_' + k, (0, 0, 0), 0.5, emis=EM[k][0], estr=EM[k][1])

exec(open(os.path.join(_here, 'assets_reading.py')).read(), globals())

# ================================================================= ASSETS
def a_table(M=I4, grp='props'):
    """The reading table: 8 m of walnut on six turned legs, a leather writing surface, a drawer for every seat."""
    L = TY1 - TY0
    box('table_top', -TW, TW, 0, L, TZ - 0.045, TZ, 'wood_l', grp, bevel=0.014, seg=3, M=M)
    box('table_under', -TW + 0.03, TW - 0.03, 0.03, L - 0.03, TZ - 0.06, TZ - 0.045, 'wood_d', grp, M=M)
    box('table_inlay', -TW + 0.13, TW - 0.13, 0.13, L - 0.13, TZ, TZ + 0.002, 'leather_g', grp, M=M)
    for d in (-1, 1):                                                                   # gilt line round the leather
        box('table_gilt', d * (TW - 0.135), d * (TW - 0.128), 0.1245, L - 0.1245, TZ + 0.002, TZ + 0.0035, 'gilt', grp, M=M)
        box('table_frieze', d * (TW - 0.07), d * (TW - 0.1), 0.08, L - 0.08, TZ - 0.19, TZ - 0.06, 'wood', grp, M=M)
        for k in range(8):                                                              # drawer fronts and their pulls
            y = 0.5 + k * (L - 1.0) / 7
            box('table_drawer', d * (TW - 0.062), d * (TW - 0.07), y - 0.36, y + 0.36, TZ - 0.17, TZ - 0.08, 'wood_l', grp, bevel=0.004, M=M)
            lathe('table_pull', [(0, 0.02), (0.012, 0.02), (0.016, 0.012), (0.006, 0.006), (0.006, 0), (0, 0)], 'brass', grp, segs=10, closed=False, M=M @ T((d * (TW - 0.062), y, TZ - 0.125), (0, d * pi / 2, 0)))
    for yy in (0.128, L - 0.128): box('table_gilt', -TW + 0.135, TW - 0.135, yy - 0.0035, yy + 0.0035, TZ + 0.002, TZ + 0.0035, 'gilt', grp, M=M)
    for yy in (0.08, L - 0.08): box('table_frieze', -TW + 0.07 + PROUD, TW - 0.07 - PROUD, yy - 0.015, yy + 0.015, TZ - 0.19, TZ - 0.06, 'wood', grp, M=M)
    for y in (0.35, L / 2, L - 0.35):
        for d in (-1, 1):
            turned('table_leg', TZ - 0.19, 0.055, 'wood', grp, M=M @ T((d * (TW - 0.12), y, 0)))
            box('table_block', d * (TW - 0.17), d * (TW - 0.07 - PROUD), y - 0.05, y + 0.05, TZ - 0.19, TZ - 0.06, 'wood', grp, M=M)
        box('table_stretcher', -TW + 0.12, TW - 0.12, y - 0.02, y + 0.02, 0.12, 0.16, 'wood', grp, bevel=0.006, M=M)
    box('table_rail', -0.025, 0.025, 0.35, L - 0.35, 0.115, 0.165, 'wood', grp, bevel=0.006, M=M)

def a_chair(M=I4, grp='props'):
    """A library chair, facing +x: leather seat with brass nails, a curved back on raked legs, turned front legs."""
    rbox('chair_seat', (0.46, 0.46, 0.035), M @ T((0, 0, 0.44)), 'wood', grp, bevel=0.012)
    rbox('chair_pad', (0.4, 0.4, 0.045), M @ T((0.01, 0, 0.475)), 'leather', grp, bevel=0.02, seg=3)
    for d in (-1, 1):
        turned('chair_leg_f', 0.43, 0.026, 'wood', grp, M=M @ T((0.19, d * 0.19, 0)), segs=10)
        rod('chair_leg_b', (-0.2, d * 0.19, 0), (-0.3, d * 0.2, 0.95), 0.02, 'wood', grp, M=M)
        rod('chair_side', (0.19, d * 0.19, 0.2), (-0.22, d * 0.19, 0.2), 0.011, 'wood', grp, M=M)
    rod('chair_front', (0.19, -0.19, 0.2), (0.19, 0.19, 0.2), 0.011, 'wood', grp, M=M)
    for k in range(8): blob('chair_nail', M @ Vector((0.232, -0.175 + k * 0.05, 0.445)), 0.006, 'brass', grp)
    for z, w in ((0.93, 0.07), (0.62, 0.035)):                                           # top rail and lower rail, both bowed
        pts = [(-0.3 - 0.03 * math.cos(a) + (0.95 - z) * 0.105, 0.21 * math.sin(a)) for a in [pi * (i / 10 - 0.5) for i in range(11)]]
        finish('chair_rail', _strip([(x, y, z - w / 2) for x, y in pts], [(x, y, z + w / 2) for x, y in pts], 0.022), 'wood', grp, M=M)
    rbox('chair_splat', (0.014, 0.13, 0.3), M @ T((-0.285, 0, 0.78), (0, -0.1, 0)), 'leather', grp, bevel=0.005)
def a_lamp(M=I4, grp='props', key=0):
    """A banker's lamp: stepped brass foot, a neck that curves over, a long green glass shade, a pull chain."""
    lathe('lamp_foot', [(0, 0.045), (0.02, 0.045), (0.03, 0.03), (0.07, 0.024), (0.1, 0.012), (0.105, 0), (0, 0)], 'brass', grp, segs=28, closed=False, M=M)
    rod('lamp_stem', (0, 0, 0.045), (0, 0, 0.3), 0.009, 'brass', grp, M=M, n=8); blob('lamp_knop', M @ Vector((0, 0, 0.17)), 0.018, 'brass', grp)
    S = M @ T((0, 0, 0.3))
    sh = [(0.075 * math.cos(a), 0.075 * math.sin(a)) for a in [pi * i / 12 for i in range(13)]]           # half-round shade along the table, open underneath
    band('lamp_shade', [(x * 1.06, z * 1.06) for x, z in sh], sh, -0.21, 0.21, 'greenlamp', grp, M=S)
    for d in (-1, 1): prism('lamp_cap', [(0, 0)] + [(x * 1.06, z * 1.06) for x, z in sh], 'Y', d * 0.21, d * 0.215, 'brass', grp, M=S)
    box('lamp_saddle', -0.02, 0.02, -0.05, 0.05, -0.004, 0.012, 'brass', grp, M=S)
    box('lamp_tube', -0.012, 0.012, -0.19, 0.19, 0.022, 0.034, em='lamp', M=S)
    for k in range(6): blob('lamp_chain', M @ Vector((0.05, 0.15, 0.29 - k * 0.014)), 0.004, 'brass', grp)
    glow(f'lamp_glow{key}', M @ Vector((0, 0, 0.24)), 22)

def a_pendant(M=I4, grp='archC'):
    """A ring light on three rods from a ceiling rose; M puts the ring's centre, the ceiling is at H."""
    z = (M @ Vector((0, 0, 0))).z
    torus('pendant', 1.05, 0.04, M, 'brass', grp); torus('pendant_light', 1.05, 0.022, M @ T((0, 0, -0.035)), em='ring')
    torus('pendant_in', 0.99, 0.012, M @ T((0, 0, 0.02)), 'gilt', grp)
    lathe('pendant_rose', [(0, 0), (0.16, 0), (0.14, -0.04), (0.06, -0.07), (0.03, -0.14), (0, -0.14)], 'brass', grp, segs=24, closed=False, M=M @ T((0, 0, H - z)))
    for a in range(3):
        ang = a * 2 * pi / 3 + 0.5; p = Vector((1.05 * math.cos(ang), 1.05 * math.sin(ang), 0))
        rod('pendant_rod', p, Vector((0.03 * math.cos(ang), 0.03 * math.sin(ang), H - z - 0.12)), 0.007, 'brass', grp, M=M, n=6)
        blob('pendant_knuckle', M @ p + Vector((0, 0, 0.045)), 0.022, 'brass', grp)

def a_terminal(M=I4, grp='props'):
    """The catalogue terminal: a brass-framed screen laid back on a hinged arm over a walnut base. Returns the screen's corners."""
    LEAN = 0.95; c = Vector((0, 0, 0.19)); up = Vector((0, math.sin(LEAN), math.cos(LEAN))); n = Vector((0, -math.cos(LEAN), math.sin(LEAN)))
    P = lambda a, b, d=0.0: tuple(M @ (c + Vector((-1, 0, 0)) * a + up * b + n * d))
    F = M @ Matrix(((1, 0, 0, c.x), (0, up.y, n.y, c.y), (0, up.z, n.z, c.z), (0, 0, 0, 1)))
    rbox('terminal_back', (0.56, 0.4, 0.03), F @ T((0, 0, -0.012)), 'frame', grp, bevel=0.012)
    for sx in (-1, 1): rbox('terminal_side', (0.012, 0.4, 0.04), F @ T((sx * 0.28, 0, -0.008)), 'brass', grp, bevel=0.004)
    for sy in (-1, 1): rbox('terminal_edge', (0.57, 0.012, 0.04), F @ T((0, sy * 0.2, -0.008)), 'brass', grp, bevel=0.004)
    box('terminal_base', -0.24, 0.24, -0.02, 0.26, 0, 0.05, 'wood', grp, bevel=0.012, M=M)
    box('terminal_plate', -0.2, 0.2, 0.0, 0.22, 0.05, 0.056, 'brass', grp, bevel=0.003, M=M)
    for sx in (-1, 1):
        rod('terminal_arm', (sx * 0.16, 0.16, 0.05), (sx * 0.16, 0.1, 0.21), 0.012, 'brass', grp, M=M)
        lathe('terminal_knuckle', [(0, -0.02), (0.02, -0.02), (0.02, 0.02), (0, 0.02)], 'brass', grp, segs=14, M=M @ T((sx * 0.16, 0.16, 0.056), (0, pi / 2, 0)))
    box('terminal_light', -0.2, 0.2, -0.024, -0.02, 0.006, 0.012, em='cool', M=M)
    for k in range(3): blob('terminal_key', M @ Vector((-0.16 + k * 0.05, 0.03, 0.058)), 0.012, 'frame', grp, squash=(1, 1, 0.4))
    return [P(0.25, -0.17, 0.006), P(-0.25, -0.17, 0.006), P(-0.25, 0.17, 0.006), P(0.25, 0.17, 0.006)]

def a_cradle(M=I4, grp='props'):
    """Where the drone rests: a brass ring on three curved legs over a charging pad."""
    torus('cradle', 0.3, 0.012, M @ T((0, 0, 0.13)), 'brass', grp); torus('cradle_in', 0.26, 0.006, M @ T((0, 0, 0.12)), 'gilt', grp)
    for a in range(3):
        ang = a * 2 * pi / 3 + 0.3; c, s = math.cos(ang), math.sin(ang)
        rod('cradle_leg', (0.3 * c, 0.3 * s, 0.13), (0.24 * c, 0.24 * s, 0.01), 0.008, 'brass', grp, M=M); blob('cradle_foot', M @ Vector((0.24 * c, 0.24 * s, 0.01)), 0.014, 'brass', grp)
    lathe('cradle_pad', [(0, 0.014), (0.09, 0.014), (0.1, 0.006), (0.1, 0), (0, 0)], 'frame', grp, segs=24, closed=False, M=M)
    # Replaceable landing shoes and sprung brass contacts, insulated from the metal rail.
    for angle in (0, 2*pi/3, 4*pi/3):
        B = M @ Matrix.Rotation(angle+.3,4,'Z') @ T((.292,0,.133))
        rbox('landing_shoe',(.06,.095,.024),B,'frame',grp,bevel=.008)
        for dy in (-.025,.025):
            lathe('charge_pin',[(0,.012),(.009,.012),(.009,.022),(.006,.025),(0,.025)],'gilt',grp,segs=12,M=B @ T((0,dy,0)))
    torus('cradle_glow', 0.07, 0.003, M @ T((0, 0, 0.0145)), em='cool', segs=32)

def a_catalogue(M=I4, grp='props'):
    """A card catalogue: a walnut cabinet of small drawers, each with a brass label holder and pull, on a stand. Faces +x."""
    box('cat_stand', -0.22, 0.22, -0.62, 0.62, 0.0, 0.5, 'wood', grp, bevel=0.01, M=M); box('cat_stand_gap', -0.2, 0.225, -0.56, 0.56, 0.08, 0.42, 'wood_d', grp, M=M)
    box('cat_body', -0.24, 0.24, -0.66, 0.66, 0.5, 1.42, 'wood', grp, bevel=0.012, M=M); box('cat_top', -0.27, 0.27, -0.69, 0.69, 1.42, 1.46, 'wood_l', grp, bevel=0.012, M=M)
    for r in range(6):
        for c in range(6):
            y, z = -0.55 + c * 0.22, 0.585 + r * 0.142
            box('cat_drawer', 0.24, 0.252, y - 0.098, y + 0.098, z - 0.058, z + 0.058, 'wood_l', grp, bevel=0.004, M=M)
            box('cat_label', 0.252, 0.256, y - 0.045, y + 0.045, z + 0.004, z + 0.04, 'brass', grp, M=M); box('cat_card', 0.256, 0.258, y - 0.037, y + 0.037, z + 0.01, z + 0.034, 'paper', grp, M=M)
            lathe('cat_pull', [(0, 0.016), (0.011, 0.016), (0.013, 0.01), (0.005, 0.005), (0.005, 0), (0, 0)], 'brass', grp, segs=8, closed=False, M=M @ T((0.252, y, z - 0.028), (0, pi / 2, 0)))

def a_cart(M=I4, grp='props'):
    """A book cart: two sloped shelves of returns between brass ends, on four castors."""
    for d in (-1, 1):
        for sy in (-1, 1): rod('cart_post', (d * 0.4, sy * 0.2, 0.12), (d * 0.4, sy * 0.2, 0.95), 0.012, 'brass', grp, M=M)
        rod('cart_handle', (d * 0.4, -0.2, 0.95), (d * 0.4, 0.2, 0.95), 0.012, 'brass', grp, M=M)
        for sy in (-1, 1):
            lathe('cart_wheel', [(0, -0.012), (0.04, -0.012), (0.04, 0.012), (0, 0.012)], 'frame', grp, segs=14, M=M @ T((d * 0.4, sy * 0.2, 0.04), (pi / 2, 0, 0))); rod('cart_fork', (d * 0.4, sy * 0.2, 0.04), (d * 0.4, sy * 0.2, 0.12), 0.008, 'brass', grp, M=M)
    for z in (0.22, 0.6):
        box('cart_shelf', -0.4, 0.4, -0.21, 0.21, z, z + 0.02, 'wood', grp, bevel=0.005, M=M); box('cart_lip', -0.4 - PROUD, 0.4 + PROUD, -0.21 - PROUD, -0.2, z, z + 0.07, 'wood', grp, M=M)
        x = -0.36
        while x < 0.3:
            t = random.uniform(0.03, 0.06); hh = random.uniform(0.2, 0.3)
            box('cart_book', x, x + t, -0.17, 0.08, z + 0.02, z + 0.02 + hh, random.choice(BOOKS), grp, M=M); x += t + 0.004
    for b in range(3):
        a_closed_book(M @ T((0.1, 0, 0.99 + b * 0.041), (0, 0, random.uniform(-0.3, 0.3))), grp,
                      size=(0.2, 0.27, 0.04), material=random.choice(BOOKS),
                      cover_name='cart_flat', bevel=0.001, pages_name=None)
    box('cart_top', -0.4, 0.4, -0.21, 0.21, 0.95, 0.97, 'wood', grp, bevel=0.005, M=M)

def a_globe(M=I4, grp='props'):
    """A floor globe in a walnut stand: horizon ring on four turned legs, a brass meridian, the sphere tilted on its axis."""
    c = Vector((0, 0, 1.0)); blob('globe', M @ c, 0.5, 'navy', grp)
    torus('globe_meridian', 0.53, 0.014, M @ Matrix.Translation(c) @ Matrix.Rotation(pi / 2, 4, 'X') @ Matrix.Rotation(0.41, 4, 'Y'), 'brass', grp)
    for la in (-0.9, -0.45, 0, 0.45, 0.9):                                               # parallels, engraved in gilt
        torus('globe_parallel', 0.502 * math.cos(la), 0.003, M @ Matrix.Translation(c) @ Matrix.Rotation(0.41, 4, 'X') @ T((0, 0, 0.502 * math.sin(la))), 'gilt', grp, segs=40)
    torus('globe_horizon', 0.6, 0.03, M @ Matrix.Translation(c), 'wood_l', grp); torus('globe_horizon_in', 0.56, 0.008, M @ T((0, 0, 1.03)), 'brass', grp)
    for a in range(4):
        ang = a * pi / 2 + 0.4; p = (0.58 * math.cos(ang), 0.58 * math.sin(ang), 0)
        turned('globe_leg', 0.97, 0.04, 'wood', grp, M=M @ T(p), segs=10); rod('globe_brace', (p[0], p[1], 0.3), (0, 0, 0.3), 0.012, 'wood', grp, M=M)
    lathe('globe_hub', [(0, 0.36), (0.05, 0.36), (0.07, 0.3), (0.05, 0.24), (0, 0.24)], 'wood', grp, segs=14, closed=False, M=M)
    for sgn in (-1, 1): blob('globe_pin', M @ (c + Vector((0, sgn * 0.53 * math.sin(0.41) * -1, sgn * 0.53 * math.cos(0.41)))), 0.022, 'brass', grp)

def a_floorlamp(M=I4, grp='props', key=0):
    lathe('fl_base', [(0, 0.05), (0.03, 0.05), (0.17, 0.02), (0.18, 0), (0, 0)], 'brass', grp, segs=24, closed=False, M=M)
    turned('fl_stem', 1.55, 0.022, 'brass', grp, M=M @ T((0, 0, 0.04)), segs=10)
    lathe('fl_shade', [(0.08, 0.0), (0.22, -0.26), (0.215, -0.26), (0.075, 0.0)], em='lamp', segs=24, M=M @ T((0, 0, 1.86)))
    glow(f'fl_glow{key}', M @ Vector((0, 0, 1.7)), 60)

def a_gallery(M=I4, grp='props', s=1, L=3.0):
    """A length of the gallery in front of the upper bookcases (wall at x = 0): boards on brackets, a moulded edge,
    turned balusters under a brass handrail, a warm line of light under the edge."""
    X = lambda a: -s * a
    def bx(n, a, b, y0, y1, zz0, zz1, m, **kw): box(n, X(a), X(b), y0, y1, zz0, zz1, m, grp, M=M, **kw)
    bx('gal_deck', 0, 1.3, 0, L, -0.12, 0, 'wood'); bx('gal_boards', 0.5, 1.28, 0, L, 0, 0.012, 'wood_l')
    moulding('gal_edge', [(X(1.3), -0.3), (X(1.36), -0.26), (X(1.33), -0.2), (X(1.38), -0.14), (X(1.38), 0.04), (X(1.3), 0.04)], 0, L, 'wood', grp, M=M)
    box('gal_light', X(1.2), X(1.26), 0.1, L - 0.1, -0.135, -0.12, em='shelf', M=M)
    for y in (0.0, L):                                                                  # a bracket under each upright (half of one at each end)
        y0, y1 = (y, y + 0.06) if y == 0 else (y - 0.06, y)
        prism('gal_bracket', [(X(0.5), -0.12), (X(1.25), -0.12), (X(1.2), -0.2), (X(0.8), -0.34), (X(0.58), -0.62), (X(0.5), -0.66)], 'Y', y0, y1, 'wood', grp, M=M)
    n = int(round(L / 0.25))
    for k in range(n):
        y = (k + 0.5) * L / n
        turned('gal_baluster', 0.9, 0.028, 'wood_l' if k % 6 else 'wood', grp, M=M @ T((X(1.33), y, 0.04)), segs=8)
    bx('gal_rail_base', 1.29, 1.37, 0, L, 0.03, 0.05, 'wood'); bx('gal_rail_cap', 1.285, 1.375, 0, L, 0.94, 0.985, 'wood', bevel=0.012)
    tube('gal_handrail', (M @ Vector((X(1.33), 0, 0))).x, (M @ Vector((0, 0, 1.01))).z, 0.022, (M @ Vector((0, 0, 0))).y, (M @ Vector((0, L, 0))).y, 'brass', grp, n=10)

def a_coffer(M=I4, grp='archC', w=4.4, d=3.0):
    """One ceiling coffer (hanging from z = 0, centred): a stepped frame, a recessed panel, a gilt rosette in the middle."""
    for k, (inset, z) in enumerate(((0.0, -0.1), (0.14, -0.05))):
        x, y = w / 2 - inset, d / 2 - inset
        for sx in (-1, 1): box('coffer_frame', sx * x, sx * (x - 0.12), -y, y, z, 0, 'wood', grp, M=M)
        for sy in (-1, 1): box('coffer_frame', -x + 0.12, x - 0.12, sy * y, sy * (y - 0.12), z, 0, 'wood', grp, M=M)
    box('coffer_panel', -w / 2 + 0.26, w / 2 - 0.26, -d / 2 + 0.26, d / 2 - 0.26, -0.012, 0, 'wood_l', grp, M=M)
    lathe('coffer_rosette', [(0, -0.05), (0.03, -0.05), (0.06, -0.03), (0.12, -0.025), (0.16, -0.012), (0.16, 0), (0, 0)], 'gilt', grp, segs=20, closed=False, M=M)
    for a in range(8): blob('coffer_petal', M @ Vector((0.1 * math.cos(a * pi / 4), 0.1 * math.sin(a * pi / 4), -0.03)), 0.03, 'gilt', grp, squash=(1, 1, 0.4))

def a_window(M=I4, grp='center'):
    """The hull window, built in the plane y = 0 looking back down the room (-y): end wall with a moulded timber arch,
    a keystone, panelled jambs, a deep sill on brackets, glazing bars with a fan in the arch head."""
    arch = [(WIN_W * math.cos(pi * i / 48), WIN_ZS + WIN_W * math.sin(pi * i / 48)) for i in range(49)]
    sc = lambda k: [(x * k, WIN_ZS + (z - WIN_ZS) * k) for x, z in arch]
    def bx(n, x0, x1, y0, y1, z0, z1, m, **kw): box(n, x0, x1, y0, y1, z0, z1, m, grp, M=M, **kw)
    bx('end_l', -WD, -WIN_W, -0.5, 0, 0, H, 'plaster'); bx('end_r', WIN_W, WD, -0.5, 0, 0, H, 'plaster'); bx('end_b', -WIN_W, WIN_W, -0.5, 0, 0, WIN_Z0, 'plaster')
    band('end_t', [(x, H) for x, _ in arch], arch, -0.5, 0, 'plaster', grp, M=M)
    for k0, k1, y0, y1, m in ((1.0 - PROUD / WIN_W, 1.05, -0.5 - PROUD, -0.1, 'wood_d'), (1.05, 1.13, -0.6, -0.42, 'wood'), (1.13, 1.17, -0.56, -0.44, 'wood_l'), (1.17, 1.2, -0.53, -0.46, 'wood')):
        band('win_arch', sc(k1), sc(k0), y0, y1, m, grp, M=M)
        for d in (-1, 1): bx('win_jamb', d * WIN_W * k0, d * WIN_W * k1, y0, y1, WIN_Z0 - 0.12, WIN_ZS, m)
    prism('win_key', [(-0.16, WIN_ZS + WIN_W * 0.99), (0.16, WIN_ZS + WIN_W * 0.99), (0.24, WIN_ZS + WIN_W * 1.26), (-0.24, WIN_ZS + WIN_W * 1.26)], 'Y', -0.66, -0.44, 'wood_l', grp, bevel=0.01, M=M)
    for d in (-1, 1): bx('win_impost', d * WIN_W * 1.0, d * WIN_W * 1.22, -0.64, -0.42, WIN_ZS - 0.1, WIN_ZS + 0.08, 'wood_l', bevel=0.012)
    bx('sill', -WIN_W * 1.2 - PROUD, WIN_W * 1.2 + PROUD, -0.95, -0.42, WIN_Z0 - 0.1, WIN_Z0 + PROUD, 'wood_l', bevel=0.02, seg=3); bx('sill_apron', -WIN_W * 1.13 + PROUD, WIN_W * 1.13 - PROUD, -0.6 + PROUD, -0.5, WIN_Z0 - 0.4, WIN_Z0 - 0.1, 'wood')
    for x in (-2.4, -0.8, 0.8, 2.4): prism('sill_bracket', [(-0.95 + 0.06, WIN_Z0 - 0.1), (-0.5, WIN_Z0 - 0.1), (-0.5, WIN_Z0 - 0.5), (-0.62, WIN_Z0 - 0.42), (-0.72, WIN_Z0 - 0.2)], 'X', x - 0.05, x + 0.05, 'wood', grp, M=M)
    # glazing bars: no pane wider than 1.3 m (cabin pressure on a single 5 m sheet would be about 200 tonnes)
    for x in (-1.3, 0.0, 1.3): bx('mullion', x - 0.035, x + 0.035, -0.22, -0.1, WIN_Z0, WIN_ZS, 'frame')
    for z in (3.15, WIN_ZS): bx('transom', -WIN_W, WIN_W, -0.22 - PROUD, -0.1, z - 0.035, z + 0.035, 'frame')
    for a in (pi / 4, pi / 2, 3 * pi / 4): rod('fan_bar', (0, -0.16, WIN_ZS), (WIN_W * math.cos(a), -0.16, WIN_ZS + WIN_W * math.sin(a)), 0.03, 'frame', grp, M=M, n=6)
    half = [(0.9 * math.cos(pi * i / 16), WIN_ZS + 0.9 * math.sin(pi * i / 16)) for i in range(17)]
    band('fan_hub', [(x * 1.07, WIN_ZS + (z - WIN_ZS) * 1.07) for x, z in half], half, -0.2, -0.12, 'frame', grp, M=M)
    for d in (-1, 1): lathe('win_latch', [(0, 0.05), (0.014, 0.05), (0.02, 0.03), (0.01, 0), (0, 0)], 'brass', grp, segs=10, closed=False, M=M @ T((d * 0.65, -0.24, 3.15), (pi / 2, 0, 0)))
    box('win_cove', -WIN_W + 0.1, WIN_W - 0.1, -0.46, -0.43, WIN_Z0 - 0.16, WIN_Z0 - 0.145, em='cool', M=M)

def a_endwall(M=I4, grp='center', d_=1):
    """Beside the window (origin on the end wall at the floor, reaching x = 0 .. d_ * w): raised-and-fielded panelling, a framed chart, a sconce."""
    w = GAL_X - (WIN_W * 1.2 + 0.2); X = lambda a: d_ * a
    def bx(n, a, b, y0, y1, z0, z1, m, **kw): box(n, X(a), X(b), y0, y1, z0, z1, m, grp, M=M, **kw)
    bx('end_panel', PROUD, w - PROUD, -0.06, 0, 0.14, 3.44, 'wood'); bx('end_plinth', 0, w, -0.1, 0, 0, 0.16, 'wood_l', bevel=0.006)
    bx('end_cornice', 0, w + PROUD, -0.14, 0, 3.44, 3.58, 'wood', bevel=0.02)
    bx('end_dado', 0, w, -0.09, 0, 1.05, 1.12, 'wood_l', bevel=0.008)
    for k in range(3):
        a, b = w * (k + 0.1) / 3, w * (k + 0.9) / 3
        for z0, z1 in ((0.3, 0.95), (1.25, 3.25)):
            bx('end_field', a, b, -0.075, -0.06, z0, z1, 'wood_d'); bx('end_raise', a + 0.07, b - 0.07, -0.09, -0.075, z0 + 0.07, z1 - 0.07, 'wood_l', bevel=0.012)
    xs = w / 2
    bx('chart_frame', xs - 0.75, xs + 0.75, -0.05, 0, 4.0, 5.0, 'gilt', bevel=0.012); bx('chart', xs - 0.69, xs + 0.69, -0.056, -0.05, 4.06, 4.94, 'navy')
    for k in range(9): blob('chart_star', M @ Vector((X(xs - 0.55 + random.random() * 1.1), -0.058, 4.15 + random.random() * 0.7)), 0.012, 'gilt', grp, squash=(1, 0.3, 1))
    bx('sconce_plate', xs - 0.05, xs + 0.05, -0.02, 0, 5.5, 5.75, 'brass', bevel=0.006)
    rod('sconce_arm', (X(xs), 0, 5.62), (X(xs), -0.2, 5.7), 0.01, 'brass', grp, M=M)
    lathe('sconce', [(0.05, 0.0), (0.13, 0.3), (0.125, 0.3), (0.045, 0.0)], em='lamp', segs=20, M=M @ T((X(xs), -0.22, 5.7)))
    glow(f'sconce_glow{d_}', M @ Vector((X(xs), -0.3, 5.9)), 40)

def a_blotter(M=I4, grp='props'):
    """A place at the table: a leather blotter, paper on it, a pen in a brass tray."""
    rbox('blot', (0.42, 0.3, 0.004), M @ T((0, 0, 0.002)), 'leather', grp); rbox('blot_paper', (0.21, 0.27, 0.002), M @ T((-0.05, 0, 0.005), (0, 0, 0.08)), 'paper', grp)
    rbox('pen_tray', (0.05, 0.2, 0.012), M @ T((0.26, 0, 0.006)), 'brass', grp, bevel=0.004); rod('pen', (0.26, -0.07, 0.016), (0.26, 0.07, 0.016), 0.005, 'frame', grp, M=M, n=6)

ASSETS = READING_ASSETS.copy()
ASSETS.update(table=a_table, chair=a_chair, lamp=a_lamp, pendant=a_pendant, terminal=a_terminal, cradle=a_cradle,
              catalogue=a_catalogue, cart=a_cart, globe=a_globe, floorlamp=a_floorlamp, gallery=a_gallery,
              coffer=a_coffer, window=a_window, endwall=a_endwall, blotter=a_blotter)

# ================================================================= ASSET BENCH: one asset alone, in a studio
bench(ASSETS, {'pendant': T((0, 0, 6.3)), 'coffer': T((0, 0, 3.0)), 'gallery': T((0, 0, 1.0))})

# ================================================================= Floor, ceiling and plaster shell
quad('floor_near', [(-WD, Y0, 0), (WD, Y0, 0), (WD, 3, 0), (-WD, 3, 0)], 'floor', 'floorN')
quad('floor_far', [(-WD, 3, 0), (WD, 3, 0), (WD, Y1, 0), (-WD, Y1, 0)], 'floor', 'floorF')
quad('ceiling', [(-WD, Y0, H), (WD, Y0, H), (WD, Y1, H), (-WD, Y1, H)], 'plaster', 'archC')
quad('backwall', [(-WD, Y0, 0), (WD, Y0, 0), (WD, Y0, H), (-WD, Y0, H)], 'plaster', 'back')
for s in (1, -1):
    g = 'archR' if s > 0 else 'archL'
    quad(f'wall_{g}', [(s * WD, Y0, 0), (s * WD, Y1, 0), (s * WD, Y1, H), (s * WD, Y0, H)], 'plaster', g)
# ---- Timber ceiling: hull-frame casings, coffers, crown moulding and lights
EDGES = [b[0] for b in BAYS] + [BAYS[-1][1]]
for k, y in enumerate(EDGES):
    box(f'beam{k}', -WD, WD, y - 0.16, y + 0.16, H - 0.6, H, 'wood', 'archC', bevel=0.012)
    box(f'beamlight{k}', -GAL_X + 0.2, GAL_X - 0.2, y - 0.2, y - 0.17, H - 0.08, H - 0.06, em=em_ramp('step', k, y, 1.2, 0.5, 1.0))
for x in (-2.2, 2.2):
    box('beam_long', x - 0.14, x + 0.14, Y0, Y1, H - 0.45, H, 'wood', 'archC', bevel=0.012)
for y0, y1 in BAYS:
    for x, w in ((0, 4.1), (-4.3, 3.9), (4.3, 3.9)): a_coffer(T((x, (y0 + y1) / 2, H)), 'archC', w=w, d=2.6)
moulding('crown_l', [(-WD, H - 0.3), (-WD + 0.1, H - 0.3), (-WD + 0.16, H - 0.2), (-WD + 0.3, H - 0.06), (-WD + 0.3, H), (-WD, H)], Y0, Y1, 'wood', 'archL')
moulding('crown_r', [(WD, H - 0.3), (WD - 0.1, H - 0.3), (WD - 0.16, H - 0.2), (WD - 0.3, H - 0.06), (WD - 0.3, H), (WD, H)], Y0, Y1, 'wood', 'archR')

# ---- Arched bow window and end wall
a_window(T((0, Y1, 0)), 'center')
for d_ in (-1, 1): a_endwall(T((d_ * (WIN_W * 1.2 + 0.2), Y1 - 0.5, 0)), 'center', d_)

# ---- Bookcase walls, galleries and ladder rails
for s in (1, -1):
    g = 'archR' if s > 0 else 'archL'; SX = s * WD
    for bi, (y0, y1) in enumerate(BAYS):
        ends = (bi == 0, bi == len(BAYS) - 1)
        a_bay(T((SX, y0, 0)), g, s, 0, shelves=not (s < 0 and bi == DOOR_BAY), ends=ends); a_bay(T((SX, y0, GAL_Z)), g, s, 1, ends=ends)
        a_gallery(T((SX, y0, GAL_Z)), g, s)
    for y0, y1 in ((Y0, BAYS[0][0]), (BAYS[-1][1], Y1 - 0.5)): a_gallery(T((SX, y0, GAL_Z)), g, s, L=y1 - y0)
    tube('ladder_rail', SX - s * 0.62, 3.3, 0.02, BAYS[0][0], BAYS[-1][1], 'brass', g, n=8)
    a_ladder(T((SX - s * 1.3, 0.3 if s > 0 else -2.2, 0)) @ Matrix.Rotation(0 if s > 0 else pi, 4, 'Z') @ Matrix.Rotation(pi, 4, 'Z'), 'props')
pressure_door('door', T((-WD + 0.02, sum(BAYS[DOOR_BAY]) / 2, 0)), 'archL', 'ATRIUM', 'SPINWARD  ·  MIDWAY', 'lobby', w=1.6, h=2.4)

# ---- Reading table, lamps, chairs and the bordered runner
box('runner', -1.9, 1.9, -3.4, 11.6, 0.0, 0.016, 'runner', 'props')
for a, b, m in ((1.78, 1.7, 'runner2'), (1.62, 1.5, 'runner3'), (1.44, 1.4, 'runner2')):
    for d in (-1, 1): box('runner_line', d * a, d * b, -3.4 + (1.9 - a) + (a - b) / 2, 11.6 - (1.9 - a) - (a - b) / 2, 0.016, 0.019, m, 'props')
    for y in (-3.4 + (1.9 - a), 11.6 - (1.9 - a)): box('runner_line', -a, a, y - (a - b) / 2, y + (a - b) / 2, 0.016, 0.019, m, 'props')
a_table(T((0, TY0, 0)))
for k, y in enumerate((1.6, 3.6, 5.6, 7.6)):
    # Leave the catalogue-to-cradle sightline clear at the near end.
    a_lamp(T((-.43 if k == 0 else 0, y, TZ + 0.002)), key=k)
    for d in (-1, 1):
        a_chair(T((d * (TW + 0.36 + random.uniform(0, 0.14)), y + random.uniform(-0.12, 0.12), 0)) @ Matrix.Rotation(pi if d > 0 else 0, 4, 'Z') @ Matrix.Rotation(random.uniform(-0.12, 0.12), 4, 'Z'))
for x, y, r in ((0.36, 4.5, 0.2), (-0.3, 6.4, -0.3), (0.3, 8.1, 0.1)): a_stack(T((x, y, TZ + 0.002), (0, 0, r)), n=random.randint(3, 6))
a_openbook(T((-0.3, 3.0, TZ + 0.002), (0, 0, 1.4))); a_openbook(T((0.32, 6.9, TZ + 0.002), (0, 0, -1.7)))
for x, y in ((-0.33, 4.6), (0.33, 5.6), (-0.33, 7.5)): a_blotter(T((x, y, TZ + 0.002), (0, 0, pi / 2 if x > 0 else -pi / 2)))
for k, y in enumerate((1.6, 5.1, 8.6)): a_pendant(T((0, y, 6.3)), 'archC')
# ---- Live catalogue screen, terminal and drone cradle
SCREENS = ['FX_screen0']
quad('FX_screen0', a_terminal(T((0, 0.86, TZ + 0.002))), 'lum_screen', fx='screen', uv=True)
CR = Vector((0, 2.6, TZ + 0.002)); a_cradle(T(CR))
# ---- Card catalogue, returns cart and window-side furnishings
a_catalogue(T((4.3, 3.3, 0)) @ Matrix.Rotation(pi, 4, 'Z')); a_cart(T((-3.6, 1.6, 0), (0, 0, 1.2)))
a_globe(T((3.6, 12.0, 0))); a_floorlamp(T((4.75, 11.7, 0)), key=1)
a_armchair(T((-3.9, 12.0, 0)) @ Matrix.Rotation(math.radians(-25), 4, 'Z')); a_floorlamp(T((-4.8, 11.5, 0)))
# where each volume lives: a slot on a shelf (wall side, bay, tier, shelf); the drone hovers in front of it
def slot(s, bay, tier, shelf):
    y0, y1 = BAYS[bay]; return [s * (WD - 0.3), (y0 + y1) / 2 + random.uniform(-0.8, 0.8), (0.14 if tier == 0 else GAL_Z + 0.12) + shelf * 0.62 + 0.3]
SLOTS = [slot(1, 1, 1, 2), slot(-1, 2, 1, 3), slot(1, 2, 0, 3), slot(-1, 4, 0, 2), slot(1, 4, 1, 1)]

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
light_level(3)                      # brighter fittings throughout: reading light
scene['lobby'] = dict(room='writing', exposure=1.3, cam=list(CAM_POS), tgt=list(CAM_TGT), close=list(CLOSE_POS), close_tgt=list(CLOSE_TGT), fov=50.0,
                      doors=DOORS, screens=SCREENS,
                      # the terminal: where to stand; the drone: its cradle, where it presents a volume, the shelf slots
                      terminal=dict(screen='FX_screen0', pos=[0.0, -1.05, 1.55], tgt=[0.0, 1.5, 1.3]),
                      drone=dict(dock=list(CR + Vector((0, 0, 0.27))), deliver=[0.0, 0.5, 1.6], slots=SLOTS),
                      portal=list(PORTAL_C), sun=list(SUN_DIR), backdrop_fov=100,
                      # the ring's spin, as in the Atrium (see build_scene.py); half: half-size of the window the sun shines through
                      spin=dict(axis=[0.0, 1.0, 0.0], period=120.0, sun_e=[sun.energy * c for c in sun.color], half=4.8), earth=dict(c=list(EARTH_C), r=EARTH_R, u=list(EARTH_U)),
                      floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=1.2), y0=Y0, y1=Y1,
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'writing.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
