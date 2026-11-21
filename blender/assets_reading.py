"""Reading furniture builders, loaded into the room's shared-kit namespace after materials."""


def a_ladder(M=I4, grp='props', h=3.4):
    """A rolling library ladder leaning in -x from its feet at the origin: two rails, round rungs, wheels, hooks at the top."""
    lean = 0.2; top = Vector((-h * math.sin(lean), 0, h * math.cos(lean)))
    for d in (-1, 1):
        s = Vector((0, d * 0.22, 0)); rod('ladder_rail', s, top + s, 0.022, 'wood_l', grp, M=M)
        lathe('ladder_wheel', [(0, -0.012), (0.045, -0.012), (0.045, 0.012), (0, 0.012)], 'brass', grp, segs=16, M=M @ T((0.02, d * 0.25, 0.045), (pi / 2, 0, 0)))
        rod('ladder_hook', top + s, top + s + Vector((-0.14, 0, 0.06)), 0.01, 'brass', grp, M=M)
        lathe('ladder_roller', [(0, -0.01), (0.03, -0.01), (0.03, 0.01), (0, 0.01)], 'brass', grp, segs=14, M=M @ Matrix.Translation(top + s + Vector((-0.15, 0, 0.03))) @ Matrix.Rotation(pi / 2, 4, 'X'))
    n = int(h / 0.3)
    for k in range(1, n):
        p = top * (k / n); rod('ladder_rung', p + Vector((0, -0.22, 0)), p + Vector((0, 0.22, 0)), 0.014, 'wood_l', grp, M=M)


def a_bay(M=I4, grp='props', s=1, tier=0, shelves=True, L=3.0, rows=6):
    """One bookcase bay, L between upright centres with `rows` shelves, built against the plane x = 0 and reaching s * -x into the room.
    Uprights with a fluted face and a capital, six shelves with brass label rails and hidden lights, books, a frieze and cornice."""
    X = lambda a: -s * a; z0 = 0.14 if tier == 0 else 0.12; top = z0 + (rows - 1) * 0.62 + 0.2
    def bx(n, a, b, y0, y1, zz0, zz1, m, **kw): box(n, X(a), X(b), y0, y1, zz0, zz1, m, grp, M=M, **kw)
    if tier == 0: bx('bay_plinth', 0, 0.5, 0, L, 0, 0.14, 'wood'); bx('bay_plinth_cap', 0, 0.53, 0, L, 0.12, 0.15, 'wood_l', bevel=0.006)
    if shelves:
        bx('bay_back', 0, 0.04, 0.1, L - 0.1, z0, top, 'wood_d')
        for k in range(rows):
            z = z0 + k * 0.62
            bx('bay_shelf', 0, 0.42, 0.1, L - 0.1, z, z + 0.04, 'wood'); bx('bay_nosing', 0.42, 0.435, 0.1, L - 0.1, z + 0.004, z + 0.036, 'wood_l')
            if k == rows - 1: break
            bx('bay_labelrail', 0.435, 0.439, 0.2, L - 0.2, z + 0.012, z + 0.03, 'brass')
            for j in range(int(L / 0.7)): bx('bay_label', 0.439, 0.4395, 0.4 + j * 0.62, 0.56 + j * 0.62, z + 0.014, z + 0.028, 'paper')
            if k % 2: box('shelflight', X(0.36), X(0.4), 0.25, L - 0.25, z + 0.57, z + 0.58, em='shelf', M=M)
            _books(M, grp, s, 0.13, L - 0.13, z + 0.04)
    for y in (0, L):                                                                    # half an upright at each end: neighbours complete it
        y0, y1 = (y, y + 0.11) if y == 0 else (y - 0.11, y)
        bx('bay_upright', 0, 0.5, y0, y1, z0, top, 'wood')
        for f in range(2):
            yy = y0 + 0.03 + f * 0.05 if y == 0 else y1 - 0.03 - f * 0.05
            bx('bay_flute', 0.5, 0.506, yy - 0.012, yy + 0.012, z0 + 0.25, top - 0.3, 'wood_d')
        bx('bay_capital', 0, 0.55, y0, y1, top - 0.2, top - 0.12, 'wood_l', bevel=0.008); bx('bay_base', 0, 0.54, y0, y1, z0, z0 + 0.16, 'wood_l', bevel=0.008)
    bx('bay_frieze', 0, 0.46, 0, L, top - 0.12, top + 0.06, 'wood'); bx('bay_plaque', 0.46, 0.466, L / 2 - 0.3, L / 2 + 0.3, top - 0.09, top + 0.02, 'brass', bevel=0.003)
    moulding('bay_cornice', [(X(0), top + 0.06), (X(0.6), top + 0.06), (X(0.62), top + 0.1), (X(0.56), top + 0.13), (X(0.6), top + 0.17), (X(0), top + 0.17)], 0, L, 'wood', grp, M=M)
    for k in range(int(L / 0.25)): bx('bay_dentil', 0.46, 0.5, 0.06 + k * 0.25, 0.19 + k * 0.25, top + 0.0, top + 0.055, 'wood_l')


def a_shelf_volume(M=I4, grp='props', *, s=1, depth=0.27, thickness=0.05, height=0.45,
                   material='book0', bands=True):
    """An upright volume from its lower back corner, with the spine facing -s * x."""
    spine = -s * depth
    box('book', 0, spine, 0, thickness, 0, height, material, grp, M=M)
    if bands:
        for z in (0.07, height - 0.09):
            box('book_band', spine, -s * (depth + 0.0015), 0.003, thickness - 0.003, z, z + 0.012,
                'gilt', grp, M=M)


def a_bookend(M=I4, grp='props', *, s=1):
    """Brass bookend from its lower back corner: a vertical side and a foot extending in +y."""
    box('bookend', 0, -s * 0.18, 0, 0.012, 0, 0.2, 'brass', grp, M=M)
    box('bookend_f', 0, -s * 0.18, 0, 0.1, 0, 0.008, 'brass', grp, M=M)


def _books(M, grp, s, y0, y1, z, deep=0.3):
    """Fill a shelf: runs of standing books (some with gilt bands), a few lying flat, bookends, the odd keepsake."""
    X = lambda a: -s * a; y = y0 + 0.02
    while y < y1 - 0.1:
        r = random.random()
        if r < 0.82:
            n = random.randint(4, 12); set_ = random.random() < 0.25; c0 = random.choice(BOOKS); h0 = random.uniform(0.38, 0.48); t0 = random.uniform(0.035, 0.055)
            for b in range(n):
                t = t0 if set_ else random.uniform(0.026, 0.07); hh = h0 if set_ else random.uniform(0.32, 0.5); d = random.uniform(0.2, deep)
                if y + t > y1 - 0.03: break
                # Keep the fit check and the short-circuited draws in the shelf layout.
                material = c0 if set_ else random.choice(BOOKS)
                bands = set_ or random.random() < 0.3
                a_shelf_volume(M @ T((X(0.05), y, z)), grp, s=s, depth=d, thickness=t, height=hh,
                               material=material, bands=bands)
                y += t + 0.004
            y += random.uniform(0.01, 0.12)
        elif r < 0.93:
            for b in range(random.randint(2, 4)):
                box('bookflat', X(0.06), X(0.34), y, y + 0.42, z + b * 0.06, z + 0.055 + b * 0.06, random.choice(BOOKS), grp, M=M)
            y += 0.5
        else:
            if random.random() < 0.5:
                a_bookend(M @ T((X(0.08), y, z)), grp, s=s)
                y += 0.16
            else: blob('keepsake', M @ Vector((X(0.22), y + 0.18, z + 0.16)), 0.15, random.choice(('brass', 'chrome', 'copper', 'white', 'marble')), grp); y += 0.42


def a_closed_book(M=I4, grp='props', *, size=(0.2, 0.27, 0.04), material='book0',
                  cover_name='book_cover', bevel=0.003, pages_name='book_pages'):
    """A closed book centred on M; omit the page block with pages_name=None."""
    rbox(cover_name, size, M, material, grp, bevel=bevel)
    if pages_name is not None:
        w, l, t = size
        rbox(pages_name, (w - 0.006, l - 0.01, t - 0.008), M @ T((0.004, 0, 0)), 'paper', grp)


def a_armchair(M=I4, grp='props'):
    """A wing chair for the window corner, buttoned leather on turned feet, with a brass side table and a book left on it."""
    boxed_cushion('arm_seat', M @ T((0, 0.03, 0.4)), .70,.66,.20,'leather',grp)
    rbox('arm_base', (0.76, 0.72, 0.12), M @ T((0, 0, 0.26)), 'leather', grp, bevel=0.03)
    back = M @ T((0,-.34,.83),(-pi/2+.2,0,0))
    boxed_cushion('arm_back', back, .76,.85,.16,'leather',grp)
    for d in (-1, 1):
        rbox('arm_arm', (0.14, 0.7, 0.36), M @ T((d * 0.41, 0, 0.52)), 'leather', grp, bevel=0.06, seg=3); rbox('arm_wing', (0.1, 0.3, 0.55), M @ T((d * 0.4, -0.2, 0.98), (-0.2, 0, d * 0.25)), 'leather', grp, bevel=0.045, seg=3)
        for sy in (-1, 1): turned('arm_foot', 0.2, 0.035, 'wood', grp, M=M @ T((d * 0.32, sy * 0.28, 0)), segs=10)
    for r in range(3):
        for c in range(4): blob('arm_button', back @ Vector((-.24+c*.16,(r-1)*.20,.073)), .011,'brass',grp)
    lathe('arm_table', [(0, 0.52), (0.22, 0.52), (0.22, 0.5), (0.03, 0.47), (0.025, 0.06), (0.15, 0.02), (0.15, 0), (0, 0)], 'brass', grp, segs=24, closed=False, M=M @ T((0.72, 0.15, 0)))
    a_closed_book(M @ T((0.72, 0.15, 0.535), (0, 0, 0.5)), grp, size=(0.16, 0.22, 0.03),
                  material=BOOKS[0], cover_name='arm_book', bevel=0.0, pages_name=None)


def a_stack(M=I4, grp='props', n=5):
    """Books left on the table: a stack, slightly askew, and one lying open."""
    z = 0
    for b in range(n):
        t = random.uniform(0.028, 0.05); w = random.uniform(0.17, 0.22); l = random.uniform(0.24, 0.3); R = T((random.uniform(-0.015, 0.015), random.uniform(-0.015, 0.015), z + t / 2), (0, 0, random.uniform(-0.3, 0.3)))
        a_closed_book(M @ R, grp, size=(w, l, t), material=random.choice(BOOKS),
                      cover_name='stack_cover', bevel=0.003, pages_name='stack_pages')
        z += t

def a_openbook(M=I4, grp='props'):
    for d in (-1, 1):
        rbox('open_cover', (0.2, 0.28, 0.006), M @ T((d * 0.102, 0, 0.003)), random.choice(BOOKS), grp); rbox('open_pages', (0.19, 0.265, 0.02), M @ T((d * 0.098, 0, 0.016), (0, -d * 0.06, 0)), 'paper', grp, bevel=0.006)
    rbox('open_ribbon', (0.012, 0.3, 0.002), M @ T((0.03, -0.03, 0.028)), 'runner3', grp)


READING_ASSETS = {
    'ladder': a_ladder,
    'bay': a_bay,
    'armchair': a_armchair,
    'stack': a_stack,
    'openbook': a_openbook,
    'closed_book': a_closed_book,
    'shelf_volume': a_shelf_volume,
    'bookend': a_bookend,
}
