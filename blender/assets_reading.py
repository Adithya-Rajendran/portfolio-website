# Library reading furniture builders for the room's shared kit namespace
def a_ladder(M=I4, grp='props', h=3.4):
    lean = 0.2; top = Vector((-h * math.sin(lean), 0, h * math.cos(lean)))
    for d in (-1, 1):
        s = Vector((0, d * 0.22, 0)); rod('ladder_rail', s, top + s, 0.022, 'wood_l', grp, M=M)
        lathe('ladder_wheel', [(0, -0.012), (0.045, -0.012), (0.045, 0.012), (0, 0.012)], 'brass', grp, segs=16, M=M @ T((0.02, d * 0.25, 0.045), (pi / 2, 0, 0)))
        rod('ladder_hook', top + s, top + s + Vector((-0.14, 0, 0.06)), 0.01, 'brass', grp, M=M)
        lathe('ladder_roller', [(0, -0.01), (0.03, -0.01), (0.03, 0.01), (0, 0.01)], 'brass', grp, segs=14, M=M @ Matrix.Translation(top + s + Vector((-0.15, 0, 0.03))) @ Matrix.Rotation(pi / 2, 4, 'X'))
    n = int(h / 0.3)
    for k in range(1, n):
        p = top * (k / n); rod('ladder_rung', p + Vector((0, -0.22, 0)), p + Vector((0, 0.22, 0)), 0.014, 'wood_l', grp, M=M)


def a_bay(M=I4, grp='props', s=1, tier=0, shelves=True, L=3.0, rows=6, ends=(False, False)):
    X = lambda a: -s * a; z0 = 0.14 if tier == 0 else 0.12; top = z0 + (rows - 1) * 0.62 + 0.2
    def bx(n, a, b, y0, y1, zz0, zz1, m, **kw): box(n, X(a), X(b), y0, y1, zz0, zz1, m, grp, M=M, **kw)
    out = lambda k: (-k * PROUD * ends[0], L + k * PROUD * ends[1])
    if tier == 0: bx('bay_plinth', 0, 0.5, *out(1), 0, 0.14, 'wood'); bx('bay_plinth_cap', 0, 0.53, *out(2), 0.12, 0.15, 'wood_l', bevel=0.006)
    if shelves:
        bx('bay_back', 0, 0.04, 0.1, L - 0.1, z0, top, 'wood_d')
        for k in range(rows):
            z = z0 + k * 0.62
            bx('bay_shelf', 0, 0.42, 0.1, L - 0.1, z, z + 0.04, 'wood'); bx('bay_nosing', 0.42, 0.435, 0.1, L - 0.1, z + 0.004, z + 0.036, 'wood_l')
            if k == rows - 1: break
            bx('bay_labelrail', 0.435, 0.439, 0.2, L - 0.2, z + 0.012, z + 0.03, 'brass')
            for j in range(int(L / 0.7)): bx('bay_label', 0.439, 0.441, 0.4 + j * 0.62, 0.56 + j * 0.62, z + 0.014, z + 0.028, 'paper')
            if k % 2: box('shelflight', X(0.36), X(0.4), 0.25, L - 0.25, z + 0.57, z + 0.58, em='shelf', M=M)
            _books(M, grp, s, 0.13, L - 0.13, z + 0.04)
    for y in (0, L):
        y0, y1 = (y, y + 0.11) if y == 0 else (y - 0.11, y)
        bx('bay_upright', 0, 0.5, y0, y1, z0, top, 'wood')
        for f in range(2):
            yy = y0 + 0.03 + f * 0.05 if y == 0 else y1 - 0.03 - f * 0.05
            bx('bay_flute', 0.5, 0.506, yy - 0.012, yy + 0.012, z0 + 0.25, top - 0.3, 'wood_d')
        c0, c1 = (y0 - PROUD * ends[0], y1 + PROUD) if y == 0 else (y0 - PROUD, y1 + PROUD * ends[1])
        bx('bay_capital', 0, 0.55, c0, c1, top - 0.2, top - 0.12, 'wood_l', bevel=0.008); bx('bay_base', 0, 0.54, c0, c1, z0, z0 + 0.16, 'wood_l', bevel=0.008)
    bx('bay_frieze', 0, 0.46, *out(1), top - 0.12, top + 0.06, 'wood'); bx('bay_plaque', 0.46, 0.466, L / 2 - 0.3, L / 2 + 0.3, top - 0.09, top + 0.02, 'brass', bevel=0.003)
    moulding('bay_cornice', [(X(0), top + 0.06), (X(0.6), top + 0.06), (X(0.62), top + 0.1), (X(0.56), top + 0.13), (X(0.6), top + 0.17), (X(0), top + 0.17)], *out(2), 'wood', grp, M=M)
    for k in range(int(L / 0.25)): bx('bay_dentil', 0.46, 0.5, 0.06 + k * 0.25, 0.19 + k * 0.25, top + 0.0, top + 0.055, 'wood_l')


def a_shelf_volume(M=I4, grp='props', *, s=1, depth=0.27, thickness=0.05, height=0.45,
                   material='book0', bands=True):

    tag = 'shelf_edges_' + material
    if tag not in MAT:
        cover = MAT[material].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:]
        m = mat(tag, (.75,.68,.55), .84); g = NT(m.node_tree)
        attr = g.node('ShaderNodeAttribute', attribute_name='binding_uv')
        axis = g.node('ShaderNodeSeparateXYZ'); g._set(axis.inputs[0],attr.outputs['Vector']); y = axis.outputs['Y']
        margin = g.math('MINIMUM',y,g.math('SUBTRACT',1.,y))
        striped = g.math('COSINE',g.math('MULTIPLY',y,96.)); val = g.math('MULTIPLY_ADD',striped,.045,.84)
        page = g.scale((.78,.70,.55),val)
        g._set(m.node_tree.nodes['Principled BSDF'].inputs['Base Color'],g.mix(g.smooth(margin,.035,.074),cover,page))
    radius = min(.0045, thickness*.11); D = depth; t = thickness
    outline = [(0,0),(D-radius,0),(D,.28),(D,.72),(D-radius,1),(0,1)]
    bm = bmesh.new(); attr = bm.verts.layers.float_vector.new('binding_uv'); rows=[]
    for h in (0.,1.):
        row=[]
        for u,y in outline:
            v=bm.verts.new((-s*u,t*y,height*h)); v[attr]=(u/D,y,h); row.append(v)
        rows.append(row)
        bm.faces.new([row[i] for i in (0,1,4,5)]).material_index=1
        bm.faces.new(row[1:5])
    for i in range(6):
        j=(i+1)%6; f=bm.faces.new((rows[0][i],rows[0][j],rows[1][j],rows[1][i])); f.material_index=int(i==5)
    ob=finish('book',bm,material,grp,M=M); ob.data.materials.append(MAT[tag])
    if bands:
        for z in (.07,height-.09):
            bm=bmesh.new(); bandsides=[]
            for zz in (z,z+.007):
                bandsides.append([bm.verts.new((-s*(u+.0025),y*t,zz)) for u,y in outline[1:5]])
                bandsides.append([bm.verts.new((-s*u,y*t,zz)) for u,y in outline[1:5]])
            a,ia,b,ib=bandsides
            for i in range(3):
                for f in ((a[i],a[i+1],b[i+1],b[i]),(a[i],a[i+1],ia[i+1],ia[i]),(b[i],b[i+1],ib[i+1],ib[i])): bm.faces.new(f)
            for k in (0,3): bm.faces.new((a[k],b[k],ib[k],ia[k]))
            finish('book_band',bm,'gilt',grp,M=M)


def a_bookend(M=I4, grp='props', *, s=1):
    box('bookend', 0, -s * 0.18, 0, 0.012, 0, 0.2, 'brass', grp, M=M)
    box('bookend_f', -s * PROUD, -s * (0.18 - PROUD), PROUD, 0.1, 0, 0.008, 'brass', grp, M=M)


def _books(M, grp, s, y0, y1, z, deep=0.3):
    X = lambda a: -s * a; y = y0 + 0.02
    while y < y1 - 0.1:
        r = random.random()
        if r < 0.82:
            n = random.randint(4, 12); set_ = random.random() < 0.25; c0 = random.choice(BOOKS); h0 = random.uniform(0.38, 0.48); t0 = random.uniform(0.035, 0.055)
            for b in range(n):
                t = t0 if set_ else random.uniform(0.026, 0.07); hh = h0 if set_ else random.uniform(0.32, 0.5); d = random.uniform(0.2, deep)
                if y + t > y1 - 0.03: break
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


def _reading_loft(bm, sections, *, smooth=False, material_index=0, gilt_sections=()):
    rings = [[bm.verts.new(p) for p in section] for section in sections]
    bm.faces.new(list(reversed(rings[0]))).material_index = material_index
    bm.faces.new(rings[-1]).material_index = material_index
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        for i in range(len(a)):
            f = bm.faces.new((a[i - 1], a[i], b[i], b[i - 1]))
            f.smooth = smooth
            f.material_index = 1 if k in gilt_sections else material_index


def _clipped_rect(x0, x1, y0, y1, cut, z):
    return [(x, y, z) for x, y in ((x0 + cut, y0), (x1 - cut, y0), (x1, y0 + cut),
                                  (x1, y1 - cut), (x1 - cut, y1), (x0 + cut, y1),
                                  (x0, y1 - cut), (x0, y0 + cut))]


def a_closed_book(M=I4, grp='props', *, size=(0.2, 0.27, 0.04), material='book0',
                  cover_name='book_cover', bevel=0.003, pages_name='book_pages'):
    w, l, t = size
    half, head, fore = t / 2, l / 2, w / 2
    board, roll = min(0.0048, t * 0.14), min(t * 0.55, w * 0.16)
    shoulder = -fore + roll
    joint = min(0.0022, t * 0.055)
    inset = min(0.004, w * 0.028, t * 0.12)
    detail = pages_name is not None
    cover = bmesh.new()

    arc = [(shoulder - roll * math.cos(a), (half - board * 0.18) * math.sin(a))
           for a in (pi * (i / 12 - 0.5) for i in range(13))]
    arc = [(shoulder + 2 * joint, -half + board * 0.62), *arc,
           (shoulder + 2 * joint, half - board * 0.62)]
    skin = board * 0.55
    inner = [(x + skin, z * (1 - skin / half)) for x, z in reversed(arc)]
    fillets = [q * l for q in (-0.334, -0.303, 0.303, 0.334)] if detail else []
    ys = [-head, *(v for y in fillets for v in (y - 0.00065, y + 0.00065)), head]
    _reading_loft(cover, [[(x, y, z) for x, z in arc + inner] for y in ys],
                  smooth=True, gilt_sections=range(1, len(ys) - 1, 2))

    for d in (-1, 1):
        heel = shoulder + joint
        chamfer = min(bevel, board * 0.22)
        def outline(z, pad=0.0, cut=0.0024):
            return _clipped_rect(heel + pad, fore - pad, -head + pad, head - pad, cut, d * z)
        rings = [outline(half - board, chamfer)]
        if chamfer:
            rings += [outline(half - board + chamfer), outline(half - chamfer)]
        rings.append(outline(half, chamfer))
        rule = ()
        if d == 1 and detail:
            rule = (len(rings),)
            rings += [outline(half, 0.009, 0.005), outline(half, 0.0103, 0.0045)]
        _reading_loft(cover, rings, gilt_sections=rule)

    leaves = bmesh.new() if detail else cover
    edge = half - board * 0.91
    gathers = [(-1.0, 0.0)]
    if detail:
        spread = min(.06, .00085 / edge)
        for u, recess in ((-.73, .00032), (-.38, .00047), (.04, .00036), (.36, .00051), (.70, .00034)):
            gathers += [(u - spread, 0), (u, recess), (u + spread, 0)]
    else:
        gathers.append((0.0, 0.0))
    gathers.append((1.0, 0.0))
    rings = []
    for u, recess in gathers:
        z = u * edge
        x0 = shoulder - roll * math.sqrt(1 - (z / half) ** 2) + board * 0.86
        x1 = fore - inset * (1 + 0.54 * (1 - u * u)) - recess
        y = head - inset * 1.15 - recess * 0.72
        rings.append([(x0, -y, z), (x1, -y, z), (x1, y, z), (x0, y, z)])
    _reading_loft(leaves, rings, material_index=0 if detail else 1)
    ob = finish(cover_name, cover, material, grp, M=M)
    ob.data.materials.append(MAT['gilt' if detail else 'paper'])
    if detail:
        finish(pages_name, leaves, 'paper', grp, M=M)


def _wing_welt(points, M, grp):
    rings = []
    for i, p in enumerate(points):
        axis = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        across = axis.cross(Vector((1, 0, 0))).normalized()
        normal = across.cross(axis)
        r = 0.0038 if 0 < i < len(points) - 1 else 0.0015
        rings.append([p + r * (math.cos(a) * across + math.sin(a) * normal)
                      for a in (k * pi / 3 for k in range(6))])
    bm = bmesh.new()
    _reading_loft(bm, rings, smooth=True)
    finish('arm_wing_welt', bm, 'leather', grp, M=M)


def a_armchair(M=I4, grp='props'):
    boxed_cushion('arm_seat', M @ T((0, 0.03, 0.4)), .70, .66, .20, 'leather', grp)
    rbox('arm_base', (0.755, 0.715, 0.107), M @ T((0, 0, 0.268)), 'leather', grp, bevel=0.022)
    frame = bmesh.new()
    _reading_loft(frame, [_clipped_rect(-x, x, -y, y, cut, z) for x, y, cut, z in
                          ((.350, .320, .028, .184), (.374, .348, .033, .205),
                           (.374, .348, .032, .218), (.363, .336, .028, .232))])
    finish('arm_frame', frame, 'wood', grp, M=M)
    back = M @ T((0, -.34, .83), (-pi / 2 + .2, 0, 0))
    boxed_cushion('arm_back', back, .76, .85, .16, 'leather', grp)

    angles = [k * 2 * pi / 16 for k in range(16)]
    arms = ((-.35, .382, .063, .235, .696), (-.27, .388, .079, .232, .696),
            (-.15, .391, .078, .232, .686), (-.02, .398, .075, .233, .661),
            (.12, .397, .074, .236, .645), (.226, .394, .085, .238, .653),
            (.293, .391, .093, .245, .679), (.325, .390, .083, .267, .670),
            (.343, .389, .057, .319, .640), (.350, .387, .019, .407, .597))
    wings = ((.631, .388, .047, -.400, -.161), (.698, .387, .071, -.432, -.119),
             (.781, .380, .076, -.453, -.086), (.887, .373, .072, -.467, -.071),
             (.994, .365, .068, -.480, -.067), (1.082, .354, .063, -.487, -.088),
             (1.158, .341, .054, -.491, -.146), (1.216, .327, .044, -.482, -.230),
             (1.246, .319, .026, -.457, -.320), (1.257, .315, .013, -.427, -.381))
    for d in (-1, 1):
        arm = bmesh.new()
        rings = []
        for y, x, rx, low, high in arms:
            row = []
            for a in angles:
                s, c = math.sin(a), math.cos(a)
                v = .5 + .5 * math.copysign(abs(s) ** .65, s)
                row.append((d * (x + rx * c * (.60 + .40 * v)), y, low + v * (high - low)))
            rings.append(row)
        _reading_loft(arm, rings, smooth=True)
        finish('arm_arm', arm, 'leather', grp, M=M)

        wing = bmesh.new()
        rings = [[(d * (x + rx * math.sin(a) - .018 * math.cos(a)),
                   (rear + front + (front - rear) * math.cos(a)) / 2, z) for a in angles]
                 for z, x, rx, rear, front in wings]
        _reading_loft(wing, rings, smooth=True)
        finish('arm_wing', wing, 'leather', grp, M=M)
        _wing_welt([Vector(ring[2]) for ring in rings[1:]], M, grp)

        turned('arm_foot', 0.20, 0.035, 'wood', grp, M=M @ T((d * 0.32, 0.28, 0)), segs=10)
        rear_leg = bmesh.new()
        _reading_loft(rear_leg, [_clipped_rect(d * x - r, d * x + r, y - r, y + r, .004, z)
                                for x, y, r, z in ((.328, -.302, .018, 0), (.323, -.286, .022, .077),
                                                   (.313, -.256, .035, .180), (.313, -.252, .037, .226))])
        finish('arm_foot', rear_leg, 'wood', grp, M=M)
    for r in range(3):
        for c in range(4):
            blob('arm_button', back @ Vector((-.24 + c * .16, (r - 1) * .20, .073)), .011, 'brass', grp)
    lathe('arm_table', [(0, 0.52), (0.22, 0.52), (0.22, 0.5), (0.03, 0.47), (0.025, 0.06), (0.15, 0.02), (0.15, 0), (0, 0)], 'brass', grp, segs=24, closed=False, M=M @ T((0.72, 0.15, 0)))
    a_closed_book(M @ T((0.72, 0.15, 0.535), (0, 0, 0.5)), grp, size=(0.16, 0.22, 0.03),
                  material=BOOKS[0], cover_name='arm_book', pages_name='arm_book_pages')


def a_stack(M=I4, grp='props', n=5):
    z = 0
    for b in range(n):
        t = random.uniform(0.028, 0.05); w = random.uniform(0.17, 0.22); l = random.uniform(0.24, 0.3); R = T((random.uniform(-0.015, 0.015), random.uniform(-0.015, 0.015), z + t / 2), (0, 0, random.uniform(-0.3, 0.3)))
        a_closed_book(M @ R, grp, size=(w, l, t), material=random.choice(BOOKS),
                      cover_name='stack_cover', bevel=0.003, pages_name='stack_pages')
        z += t


def _reading_patch(bm, points, *, smooth=True, accent_cols=()):
    rows = [[bm.verts.new(p) for p in row] for row in points]
    for a, b in zip(rows, rows[1:]):
        for i in range(len(a) - 1):
            f = bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
            f.smooth = smooth
            f.material_index = int(i in accent_cols)


def _folio_paper():
    if 'folio_paper' not in MAT:
        m = mat('folio_paper', (.82,.76,.65), .86)
        nt = m.node_tree; coord = nt.nodes.new('ShaderNodeAttribute'); coord.attribute_name = 'folio_xy'
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(os.path.join(HERE,'textures_dl','field-folio.png'),check_existing=True)
        tex.extension = 'EXTEND'; nt.links.new(coord.outputs['Vector'],tex.inputs['Vector'])
        nt.links.new(tex.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    return 'folio_paper'


def a_openbook(M=I4, grp='props'):
    material = random.choice(BOOKS)
    random.choice(BOOKS)
    for d in (-1, 1):
        box('open_cover', d * .007, d * .202, -.14, .14, 0, .006, material, grp,
            bevel=.001, M=M)
    spine = bmesh.new()
    profile = [(-.015, .0018), (-.008, .0006), (0, .0002), (.008, .0006), (.015, .0018),
               (.015, .004), (.010, .006), (.004, .009), (0, .0095), (-.004, .009),
               (-.010, .006), (-.015, .004)]
    _reading_loft(spine, [[(x, y, z) for x, z in profile] for y in (-.14 + PROUD, .14 - PROUD)], smooth=True)
    finish('open_spine', spine, material, grp, M=M)

    def leaf(d, u, v, f, recess=0.0):
        x = d * (.0011 + u * (.191 - .0026 * v * v) + (.0018 * f**3 - recess) * u**5)
        y = v * (.1315 - .003 * u * (1 - u) + .0012 * f * f - recess)
        bottom = .006 + .003 * (1 - u)**2
        rise = (.023 if d == 1 else .0185) * math.sin(pi * u)**.85 * (1 - .90 * u)
        top = .0128 + .004 * u + rise + .0012 * u * (v * v + d * v)
        return x, y, bottom + f * (top - bottom)

    us = (0, .035, .085, .15, .23, .34, .47, .61, .75, .88, 1)
    vs = (-1, -.52, 0, .52, 1)
    rim = ((0, 0), (.24, 0), (.28, .00035), (.33, 0), (.52, 0), (.57, .00046),
           (.62, 0), (.78, 0), (.83, .00036), (.89, 0), (.95, .00075), (1, 0))
    for d in (-1, 1):
        pages = bmesh.new()
        _reading_patch(pages, [[leaf(d, u, v, 0) for v in vs] for u in us])
        sheet = bmesh.new(); coords = sheet.verts.layers.float_vector.new('folio_xy'); grid = []
        for u in us:
            row = []
            for v in vs:
                pt = sheet.verts.new(leaf(d,u,v,1)); pt[coords] = (.5+d*.5*u,.5+.5*v,0.); row.append(pt)
            grid.append(row)
        for a,b in zip(grid,grid[1:]):
            for j in range(len(vs)-1):
                corners=(a[j],b[j],b[j+1],a[j+1]); sheet.faces.new(corners if d>0 else corners[::-1]).smooth=True
        finish('printed_leaf',sheet,_folio_paper(),'folio',M=M,keep_normals=True)
        for v in (-1, 1):
            _reading_patch(pages, [[leaf(d, u, v, f, r) for u in us] for f, r in rim], smooth=False)
        for u in (0, 1):
            _reading_patch(pages, [[leaf(d, u, v, f, r) for v in vs] for f, r in rim], smooth=False)
        finish('open_pages', pages, 'paper', grp, M=M)

    ribbon = bmesh.new()
    path = []
    for i in range(12):
        s = i / 11
        u, v = .064 + .080 * s + .026 * math.sin(pi * s), .82 - 1.82 * s
        x, y, z = leaf(1, u, v, 1)
        xx, _, zz = leaf(1, u + .005, v, 1)
        path.append((x, y, z + .00082, (zz - z) / (xx - x)))
    x, y, z, tilt = path[-1]
    path += [(x + .001, y - .0026, z - .0012, tilt), (x + .002, y - .005, z - .005, tilt * .7),
             (x + .004, y - .011, .010, tilt * .3), (x + .007, y - .022, .0034, 0),
             (x + .008, -.179, .0012, 0)]
    section = ((-.0042, 0), (0, .0004), (.0042, 0), (.0042, -.00055), (-.0042, -.00055))
    _reading_loft(ribbon, [[(x + dx, y + .30 * dx, z + dz + tilt * dx) for dx, dz in section]
                           for x, y, z, tilt in path], smooth=True)
    finish('open_ribbon', ribbon, 'runner3', grp, M=M)


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
