"""
ARCADIA STATION — lobby scene builder (Blender 5.0, Cycles).
Run:  ./run.sh -b --python build_scene.py
Writes lobby.blend next to this file.

Every mesh object carries one of these custom properties:
  grp = '<bake atlas>'   -> lighting + reflections path-traced into a texture
  em  = '<colour key>'   -> thin light strips; kept as HDR flat colour in three.js
  fx  = '<name>'         -> placeholder replaced by a realtime effect in three.js
"""
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix

random.seed(7)
HERE = os.path.dirname(os.path.abspath(__file__))
pi = math.pi

# ----------------------------------------------------------------- dimensions
W = 10.0            # half width of hall
Y0, Y1 = -7.0, 26.0  # hall extents (camera looks along +Y)
# The hall is one compartment of the ring: a stretch of pressure tube with the deck as a chord across it. Its roof is
# the hull itself, so everything above the balcony follows a circle about the tube's axis, HC above the deck.
HC = 2.3            # height of the tube axis above the deck
RL = 10.05          # radius of the hull lining
RIB_IN, RIB_OUT = 9.7, 10.4     # hull ring frames (the ribs), on the ring's 4 m pitch
WALL_Z = 4.6        # up to the balcony floor, flat service walls stand in front of the hull
H = HC + RL         # crown of the lining
FX = 5.9            # half width of the central polished floor
PLAT_Z = 0.45       # side platform height
MEZ_Z = 4.2         # underside of mezzanine
RIB_Y = [-5 + 4 * k for k in range(8)]
BAYS = [y + 2 for y in RIB_Y[:-1]]          # bay centres
DAIS = Vector((0, 7.5, 0))
PORTAL_C = Vector((0, Y1, 5.65))
PORTAL_R = 4.6
STAIR_Y = 21.1
FLOOR_SPLIT = 5.0
FLOOR_IOR = 1.6            # polished stone; reflections come from Fresnel, not a mirror coating
FLOOR_ROUGH = (0.09, 0.12)   # uniformly polished: reflection quality must not vary from slab to slab
HOLO_Z = 1.55               # hologram hovers at chest height, below the horizon line of the window
PEOPLE = False              # figures are a later project; the generator below is kept but switched off
CAM_POS = Vector((0, -4.2, 1.65))
EARTH_FOCUS = (53.0, 6.0)    # latitude, longitude seen in the middle of the portal
EARTH_SPIN = float(os.environ.get('SPIN', 40.0))  #          # rotation of the view about that point (degrees)
CAM_TGT = Vector((0, 10, 3.5))
SUN_EL, SUN_AZ = math.radians(12.5), math.radians(1.5)   # sunrise: the sun has just cleared Earth's horizon, inside the portal
SUN_DIR = Vector((math.sin(SUN_AZ) * math.cos(SUN_EL), math.cos(SUN_AZ) * math.cos(SUN_EL), math.sin(SUN_EL)))

# ----------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COL = bpy.data.collections.new('Lobby'); scene.collection.children.link(COL)
OUT = bpy.data.collections.new('Outside'); scene.collection.children.link(OUT)
FXC = bpy.data.collections.new('FX'); scene.collection.children.link(FXC)

# ----------------------------------------------------------------- materials
MAT = {}
exec(open(os.path.join(HERE, 'surface_finishes.py')).read(), globals())

class NT:
    """Small helper to wire shader nodes: values may be sockets or constants."""
    def __init__(self, nt): self.nt = nt
    def node(self, t, **kw):
        n = self.nt.nodes.new(t)
        for a, v in kw.items(): setattr(n, a, v)
        return n
    def _set(self, sock, v):
        if v is None: return
        if isinstance(v, bpy.types.NodeSocket): self.nt.links.new(v, sock)
        else: sock.default_value = v
    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for sck, v in zip(n.inputs, (a, b, c)): self._set(sck, v)
        return n.outputs[0]
    def vmath(self, op, a, b=None, scale=None):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self._set(n.inputs[0], a); self._set(n.inputs[1], b); self._set(n.inputs[3], scale)
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH') else n.outputs[0]
    def mix(self, fac, a, b, blend='MIX'):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        self._set(n.inputs[0], fac); self._set(n.inputs[6], a); self._set(n.inputs[7], b)
        return n.outputs[2]
    def smooth(self, v, e0, e1, t0=0.0, t1=1.0):
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP')
        self._set(n.inputs['Value'], v)
        n.inputs['From Min'].default_value = e0; n.inputs['From Max'].default_value = e1
        n.inputs['To Min'].default_value = t0; n.inputs['To Max'].default_value = t1
        return n.outputs['Result']
    def scale(self, col, f):
        return self.vmath('SCALE', col, scale=f)

def mat(name, base=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, ior=1.5, coat=0.0, emis=None, estr=0.0, var=0.0, seams=None, seam_w=0.005):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['IOR'].default_value = ior
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = 0.05
    if emis:
        b.inputs['Emission Color'].default_value = (*emis, 1)
        b.inputs['Emission Strength'].default_value = estr
    if var > 0:
        # No real surface is uniformly clean and smooth. Layered detail, all of which ends up in the bake:
        #   smudges + brushed grain in the roughness, panel joints, and grime gathering in corners (AO).
        nt = m.node_tree; g = NT(nt)
        tc = g.node('ShaderNodeTexCoord'); geo = g.node('ShaderNodeNewGeometry')
        n1 = g.node('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 0.9; n1.inputs['Detail'].default_value = 6.0
        n1.inputs['Roughness'].default_value = 0.65
        mp = g.node('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (40.0, 40.0, 1.5)
        n2 = g.node('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 6.0; n2.inputs['Detail'].default_value = 3.0
        nt.links.new(tc.outputs['Object'], n1.inputs['Vector'])
        nt.links.new(tc.outputs['Object'], mp.inputs[0]); nt.links.new(mp.outputs[0], n2.inputs['Vector'])
        smudge = g.math('MULTIPLY_ADD', n2.outputs['Fac'], 0.35, n1.outputs['Fac'])
        r = g.node('ShaderNodeMapRange')
        r.inputs['From Min'].default_value = 0.35; r.inputs['From Max'].default_value = 1.0
        r.inputs['To Min'].default_value = max(0.02, rough - var); r.inputs['To Max'].default_value = rough + var
        nt.links.new(smudge, r.inputs['Value']); rsock = r.outputs['Result']
        seam = None
        if seams:
            P = g.node('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], P.inputs[0])
            Nn = g.node('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['True Normal'], Nn.inputs[0])
            for ax, size in enumerate(seams):
                if not size: continue
                d = g.math('MULTIPLY', g.math('ABSOLUTE', g.math('SUBTRACT', g.math('FRACT', g.math('MULTIPLY_ADD', P.outputs[ax], 1.0 / size, 0.5)), 0.5)), size)
                line = g.smooth(d, seam_w, seam_w * 0.35)                                  # 1 inside the joint
                line = g.math('MULTIPLY', line, g.smooth(g.math('ABSOLUTE', Nn.outputs[ax]), 0.75, 0.5))   # not on faces perpendicular to this axis
                seam = line if seam is None else g.math('MAXIMUM', seam, line)
        ao = g.node('ShaderNodeAmbientOcclusion', samples=6); ao.inputs['Distance'].default_value = 0.4
        grime = g.smooth(ao.outputs['AO'], 0.92, 0.45)
        dark = g.math('MULTIPLY', grime, 0.6)
        if seam is not None: dark = g.math('MAXIMUM', dark, g.math('MULTIPLY', seam, 0.85))
        col = g.mix(dark, (*base, 1), (base[0] * 0.12, base[1] * 0.11, base[2] * 0.10, 1))
        tint = g.mix(g.smooth(n1.outputs['Fac'], 0.35, 0.75), (0.86, 0.86, 0.86, 1), (1.08, 1.08, 1.08, 1))   # subtle panel-to-panel tone shift
        nt.links.new(g.mix(1.0, col, tint, 'MULTIPLY'), b.inputs['Base Color'])
        nt.links.new(g.math('ADD', rsock, g.math('MULTIPLY', dark, 0.35), clamp=True), b.inputs['Roughness'])
        height = g.math('MULTIPLY', n2.outputs['Fac'], 0.06)
        if seam is not None: height = g.math('SUBTRACT', height, seam)
        bump = g.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.55; bump.inputs['Distance'].default_value = 0.004
        nt.links.new(height, bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    if name in SURFACE_FAMILIES:
        apply_finish(NT(m.node_tree), b, SURFACE_FAMILIES[name], base, rough)
    MAT[name] = m
    return m

mat('wall', (0.11, 0.12, 0.14), 0.36, 0.85, var=0.12, seams=(1.25, 2.0, 1.25))
mat('wall2', (0.16, 0.175, 0.2), 0.3, 0.7, var=0.1, seams=(0, 1.0, 0.61))
mat('rib', (0.74, 0.76, 0.79), 0.28, 0.0, 1.5, 0.4, var=0.07, seams=(2.3, 0, 1.9))
mat('stone', (0.62, 0.63, 0.65), 0.22, 0.0, 1.6, var=0.08, seams=(1.475, 0, 0))
mat('dark', (0.018, 0.02, 0.024), 0.3, 0.0, 1.5)
mat('ceil', (0.065, 0.07, 0.08), 0.5, 0.6, var=0.1, seams=(1.3, 2.0, 1.3))
mat('copper', (0.95, 0.45, 0.2), 0.2, 1.0, var=0.1)
mat('chrome', (0.86, 0.88, 0.9), 0.07, 1.0)
mat('white', (0.84, 0.85, 0.87), 0.14, 0.0, 1.5, 1.0, var=0.06)
mat('plat', (0.075, 0.08, 0.09), 0.58, 0.0, 1.5, var=0.08, seams=(0.9, 1.0, 0))   # honed (matte) stone: deliberately not a mirror
mat('sofa', (0.8, 0.2, 0.035), 0.75)
mat('leaf', (0.07, 0.42, 0.14), 0.4)
mat('bark', (0.09, 0.06, 0.04), 0.8)
mat('brass', (0.9, 0.62, 0.3), 0.3, 1.0, var=0.08)
mat('banner_o', (0.72, 0.18, 0.03), 0.85)
mat('banner_n', (0.03, 0.06, 0.16), 0.85)
mat('crate_w', (0.55, 0.56, 0.58), 0.5, var=0.1)
mat('crate_o', (0.7, 0.22, 0.04), 0.55, var=0.1)
mat('lum_warm', (0, 0, 0), 0.5, emis=(1.0, 0.66, 0.4), estr=0.45)
mat('soil', (0.02, 0.015, 0.01), 0.9)
mat('glasstop', (0.01, 0.012, 0.016), 0.03, 0.0, 1.8, 1.0)
# big luminous surfaces that are baked (they get texture + tone mapping)
mat('lum_cool', (0, 0, 0), 0.5, emis=(0.62, 0.86, 1.0), estr=0.28)
mat('lum_screen', (0, 0, 0), 0.5, emis=(0.25, 0.7, 1.0), estr=0.3)
# thin strips: real-time HDR colour in three.js; here they are the actual light sources
EM = {
    'cyan':  ((0.05, 0.75, 1.0), 6.0),
    'ice':   ((0.5, 0.86, 1.0), 2.4),
    'amber': ((1.0, 0.36, 0.05), 4.5),
    'warm':  ((1.0, 0.74, 0.5), 3.2),
    'white': ((0.85, 0.93, 1.0), 3.0),
    'chandA': ((1.0, 0.72, 0.46), 40.0),  # orrery rings turning one way ...   (bright LEDs: the orrery is a real
    'chandB': ((1.0, 0.72, 0.46), 40.0),  # ... and the other                    light source, so its turning shows)
    'sign':  ((1.0, 0.86, 0.7), 2.4),
    'step':  ((1.0, 0.7, 0.45), 3.0),     # hidden wash lights under step nosings, the balcony taper and the coves
    'stair': ((0.5, 0.86, 1.0), 4.0),     # the same, under the nosings of the grand stair
    'gate':  ((0.5, 1.0, 0.72), 2.2),     # status light over an open gate
    'mark':  ((1.0, 0.8, 0.6), 1.0),      # in-ground marker lights (ramped along the hall)
}
for k, (c, s) in EM.items():
    mat('EM_' + k, (0, 0, 0), 0.5, emis=c, estr=s)

def MIXIN(n, key):
    """ShaderNodeMix has duplicate socket names per data type -> index explicitly."""
    col = n.data_type == 'RGBA'
    return n.inputs[{'Factor': 0, 'A': 6 if col else 2, 'B': 7 if col else 3}[key]]
def MIXOUT(n):
    return n.outputs[2 if n.data_type == 'RGBA' else 0]

def em_ramp(base, idx, y, lo, hi, power=1.6):
    """Emissive key whose strength rises along the hall from lo (behind the camera) to hi (at the portal)."""
    key = f'{base}{idx}'
    if key not in EM:
        f = min(1.0, max(0.0, (y - Y0) / (Y1 - Y0)))
        EM[key] = (EM[base][0], lo + (hi - lo) * f ** power)
        mat('EM_' + key, (0, 0, 0), 0.5, emis=EM[key][0], estr=EM[key][1])
    return key

# --- polished floor: dark slabs with fine joints and slight roughness breakup
def floor_material():
    m = mat('floor', (0.03, 0.032, 0.036), 0.05, 0.0, FLOOR_IOR)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset = 0.0; br.squash = 1.0
    S = FX / 4.0
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = S
    br.inputs['Row Height'].default_value = S
    br.inputs['Mortar Size'].default_value = 0.007
    br.inputs['Mortar Smooth'].default_value = 0.1
    br.inputs['Bias'].default_value = 0.0
    br.inputs['Color1'].default_value = (0.04, 0.042, 0.047, 1)
    br.inputs['Color2'].default_value = (0.06, 0.062, 0.067, 1)
    br.inputs['Mortar'].default_value = (0.004, 0.004, 0.005, 1)
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    nt.links.new(br.outputs['Color'], b.inputs['Base Color'])
    no = nt.nodes.new('ShaderNodeTexNoise'); no.inputs['Scale'].default_value = 0.55
    no.inputs['Detail'].default_value = 5.0
    nt.links.new(tc.outputs['Object'], no.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.3; mr.inputs['From Max'].default_value = 0.75
    mr.inputs['To Min'].default_value = FLOOR_ROUGH[0]; mr.inputs['To Max'].default_value = FLOOR_ROUGH[1]
    nt.links.new(no.outputs['Fac'], mr.inputs['Value'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'FLOAT'
    nt.links.new(br.outputs['Fac'], MIXIN(mx, 'Factor'))
    nt.links.new(mr.outputs['Result'], MIXIN(mx, 'A'))
    MIXIN(mx, 'B').default_value = 0.55
    nt.links.new(MIXOUT(mx), b.inputs['Roughness'])
floor_material()

# ----------------------------------------------------------------- mesh helpers
def face_in(bm):
    """Flip faces of open, planar surfaces so they face the middle of the hall."""
    bm.normal_update()
    ref = Vector((0, 9, 4))
    for f in bm.faces:
        if f.normal.dot(ref - f.calc_center_median()) < 0: f.normal_flip()

def finish(name, bm, m, grp=None, em=None, fx=None, bevel=0.0, seg=2, col=None, M=None, keep_normals=False):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    if not keep_normals: bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if M is not None:
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    (col or (FXC if fx else COL)).objects.link(ob)
    if em:
        me.materials.append(MAT['EM_' + em]); ob['em'] = em
    else:
        me.materials.append(MAT[m])
    if grp: ob['grp'] = grp
    if fx: ob['fx'] = fx
    if bevel > 0:
        md = ob.modifiers.new('bev', 'BEVEL')
        md.width = bevel; md.segments = seg; md.limit_method = 'ANGLE'
        md.angle_limit = math.radians(35)
    return ob

def box(name, x0, x1, y0, y1, z0, z1, m=None, grp=None, **kw):
    x0, x1 = min(x0, x1), max(x0, x1); y0, y1 = min(y0, y1), max(y0, y1); z0, z1 = min(z0, z1), max(z0, z1)
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])
    return finish(name, bm, m, grp, **kw)

def quad(name, pts, m=None, grp=None, uv=False, **kw):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    f = bm.faces.new(vs)
    if uv:
        l = bm.loops.layers.uv.new('UVMap')
        for lp, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            lp[l].uv = c
    bm.normal_update()
    face_in(bm)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    fx = kw.get('fx'); em = kw.get('em')
    (kw.get('col') or (FXC if fx else COL)).objects.link(ob)
    me.materials.append(MAT['EM_' + em] if em else MAT[m])
    if em: ob['em'] = em
    if grp: ob['grp'] = grp
    if fx: ob['fx'] = fx
    if fx == 'glass': ob.hide_render = True
    return ob

def prism(name, pts, axis, a0, a1, m=None, grp=None, **kw):
    """Extrude 2D polygon along an axis. axis 'Y': pts=(x,z); axis 'X': pts=(y,z)."""
    def P(p, a):
        return (p[0], a, p[1]) if axis == 'Y' else (a, p[0], p[1])
    bm = bmesh.new()
    A = [bm.verts.new(P(p, a0)) for p in pts]
    B = [bm.verts.new(P(p, a1)) for p in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((A[i], A[j], B[j], B[i]))
    bm.faces.new(A); bm.faces.new(list(reversed(B)))
    return finish(name, bm, m, grp, **kw)

def band(name, outer, inner, y0, y1, m=None, grp=None, **kw):
    """Solid band between two polylines (x,z) extruded along Y (ribs, strips)."""
    bm = bmesh.new()
    def V(p, y): return bm.verts.new((p[0], y, p[1]))
    O0 = [V(p, y0) for p in outer]; I0 = [V(p, y0) for p in inner]
    O1 = [V(p, y1) for p in outer]; I1 = [V(p, y1) for p in inner]
    n = len(outer)
    for i in range(n - 1):
        bm.faces.new((O0[i], O0[i + 1], I0[i + 1], I0[i]))
        bm.faces.new((O1[i], I1[i], I1[i + 1], O1[i + 1]))
        bm.faces.new((O0[i], O1[i], O1[i + 1], O0[i + 1]))
        bm.faces.new((I0[i], I0[i + 1], I1[i + 1], I1[i]))
    bm.faces.new((O0[0], I0[0], I1[0], O1[0]))
    bm.faces.new((O0[-1], O1[-1], I1[-1], I0[-1]))
    return finish(name, bm, m, grp, **kw)

def lathe(name, prof, m=None, grp=None, segs=128, a0=0.0, a1=2 * pi, closed=True, **kw):
    """Revolve (r,z) profile about Z. Use M=... to place it."""
    full = abs((a1 - a0) - 2 * pi) < 1e-6
    n = segs if full else segs + 1
    bm = bmesh.new()
    rings = []
    for i in range(n):
        a = a0 + (a1 - a0) * i / segs
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in prof])
    k = len(prof)
    for i in range(n if full else n - 1):
        j = (i + 1) % n
        for q in range(k if closed else k - 1):
            q2 = (q + 1) % k
            try:
                bm.faces.new((rings[i][q], rings[j][q], rings[j][q2], rings[i][q2]))
            except ValueError:
                pass
    if not full and closed:
        bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    for f in bm.faces: f.smooth = True
    return finish(name, bm, m, grp, **kw)

def T(loc, rot=(0, 0, 0)):
    from mathutils import Euler
    return Matrix.Translation(loc) @ Euler(rot, 'XYZ').to_matrix().to_4x4()

# ---- lettering helpers
def text3d(name, body, size, M, em='sign', spacing=1.12, extrude=0.012):
    """Extruded lettering. M maps text space (x = reading direction, y = up, z = towards the reader) to the world."""
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.align_x = 'CENTER'; cu.extrude = extrude
    cu.space_character = spacing
    tmp = bpy.data.objects.new(name + '_c', cu); COL.objects.link(tmp); tmp.matrix_world = M
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); me.transform(M)
    bpy.data.objects.remove(tmp)
    ob = bpy.data.objects.new(name, me); COL.objects.link(ob)
    me.materials.clear(); me.materials.append(MAT['EM_' + em]); ob['em'] = em
    return ob
def wall_M(s, x, y, z):
    """Placement on a side wall (s = +1 right, -1 left), facing the hall."""
    return Matrix(((0, 0, -s, x), (-s, 0, 0, y), (0, 1, 0, z), (0, 0, 0, 1)))
def tube(name, cx, cz, r, y0, y1, m, grp, n=12, **kw):
    return prism(name, [(cx + r * math.cos(2 * pi * i / n), cz + r * math.sin(2 * pi * i / n)) for i in range(n)], 'Y', y0, y1, m, grp, **kw)
def blob(name, c, r, m, grp, squash=(1, 1, 1)):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*squash, 1)), verts=bm.verts)
    for f in bm.faces: f.smooth = True
    return finish(name, bm, m, grp)

# ---- pressure doors: every compartment is sealed from the next, so every way out of a room is one of these
DOORS = []          # exported to scene.json: where each door is, which way it faces, where it leads
def pressure_door(name, M, grp, title, sub='', to='', w=1.8, h=2.5, stops=None):
    """Sliding two-leaf pressure door in a heavy frame. M: origin on the wall at floor level, +x into the room, +y along the wall."""
    def kb(n, size, loc, m=None, em=None, bevel=0.0):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(loc) @ Matrix.Diagonal((*size, 1)), verts=bm.verts)
        return finish(f'{name}_{n}', bm, m, None if em else grp, em=em, bevel=bevel, M=M)
    for d in (-1, 1):
        kb(f'jamb{d}', (0.36, 0.28, h + 0.3), (0.06, d * (w / 2 + 0.14), (h + 0.3) / 2), 'rib', bevel=0.03)
        kb(f'leaf{d}', (0.08, w / 2 - 0.015, h), (-0.03, d * w / 4, h / 2), 'wall2', bevel=0.012)
        for i in range(3): kb(f'bar{d}{i}', (0.05, w / 2 - 0.22, 0.09), (0.03, d * w / 4, 0.45 + i * 0.8), 'rib', bevel=0.01)
        kb(f'slit{d}', (0.02, 0.14, 0.62), (0.015, d * 0.28, 1.72), 'lum_cool')
        # A rebated gasket at the meeting stile and a pull with knuckle clearance.
        kb(f'gasket{d}', (0.023, 0.016, h - 0.06), (0.012, d * 0.012, h / 2), 'dark')
        for z in (0.91, 1.29):
            kb('pull_boss', (0.038, 0.08, 0.07), (0.037, d * 0.1, z), 'rib', bevel=0.008)
            kb('pull_return', (0.09, 0.031, 0.031), (0.089, d * 0.1, z), 'brass', bevel=0.007)
        kb(f'grip{d}', (0.032, 0.032, 0.41), (0.127, d * 0.1, 1.1), 'brass', bevel=0.009)
        for z in (0.2, h - 0.22):
            # Removable jamb covers; captive hex heads are proud of the face.
            kb('inspection_plate', (0.014, 0.22, 0.29), (0.248, d*(w/2+0.14), z), 'wall2', bevel=0.008)
            for sy in (-0.08, 0.08):
                for sz in (-0.11, 0.11):
                    lathe('jamb_fastener', [(0,0),(.012,0),(.012,.008),(0,.008)], 'chrome', grp, segs=6, M=M @ T((.255,d*(w/2+.14)+sy,z+sz),(0,pi/2,0)))
        for i in range(4): kb(f'chev{d}{i}', (0.012, 0.2, 0.09), (0.245, d * (w / 2 + 0.14), 0.25 + i * 0.22), 'brass' if i % 2 == 0 else 'dark')   # warning bands at the foot of the frame
    kb('lintel', (0.36, w + 0.56, 0.32), (0.06, 0, h + 0.16), 'rib', bevel=0.03)
    kb('sill', (0.55, w + 0.56, 0.05), (0.14, 0, 0.025), 'brass')
    kb('status', (0.02, w * 0.72, 0.05), (0.245, 0, h + 0.07), em='gate' if to or stops else 'amber')          # green: open for use, amber: sealed
    face = lambda z: M @ Matrix(((0, 0, 1, 0.25), (1, 0, 0, 0), (0, 1, 0, z), (0, 0, 0, 1)))
    text3d(name + '_t', title, 0.25, face(h + 0.56), spacing=1.3)
    if sub: text3d(name + '_s', sub, 0.11, face(h + 0.4), spacing=1.5)
    DOORS.append(dict(c=list(M @ Vector((0.3, 0, h / 2))), n=list(M.to_3x3() @ Vector((1, 0, 0))), to=to, label=title,       # to: room id, '' = sealed
                      **({'stops': stops} if stops else {})))                                                             # stops: [[label, room id], ...]

# ---- small builders every room's assets use, and the bench that shows one asset on its own
I4 = Matrix.Identity(4)
def rbox(name, size, M, m, grp, bevel=0.0, **kw):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
    return finish(name, bm, m, grp, bevel=bevel, M=M, **kw)
def boxed_cushion(name, M, w, depth, height, material, grp):
    """Boxed upholstery with a crowned panel, side boxing and a raised sewn welt, not a bevelled solid."""
    bm = bmesh.new(); rings = []; n = 48
    for radius, lift in ((.04,-.48),(.91,-.48),(.99,-.37),(1,-.24),(1,.21),(1.009,.26),(1.009,.29),(.998,.32),(.97,.38),(.8,.46),(.53,.50),(.24,.51),(.04,.51)):
        row=[]
        for k in range(n):
            a = k*2*pi/n; co, si = math.cos(a), math.sin(a)
            x = math.copysign(abs(co)**.31,co)*w*.5*radius; y = math.copysign(abs(si)**.31,si)*depth*.5*radius
            row.append(bm.verts.new((x,y,height*lift)))
        if rings:
            prev=rings[-1]
            for j in range(n): bm.faces.new((prev[j-1], prev[j], row[j], row[j-1])).smooth=True
        rings.append(row)
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1]); return finish(name,bm,material,grp,M=M)

def glow(name, loc, watts, color=(1.0, 0.58, 0.28), r=0.12):
    l = bpy.data.lights.new(name, 'POINT'); l.energy = watts; l.color = color; l.shadow_soft_size = r
    o = bpy.data.objects.new(name, l); COL.objects.link(o); o.location = loc; return o
def torus(name, R, r, M, m=None, grp=None, segs=64, **kw):
    return lathe(name, [(R + r * math.cos(a * pi / 4), r * math.sin(a * pi / 4)) for a in range(8)], m, grp, segs=segs, M=M, **kw)
def rod(name, a, b, r, m, grp, M=I4, n=8, **kw):
    """A round bar from a to b."""
    a, b = Vector(a), Vector(b); L = (b - a).length
    return lathe(name, [(0, 0), (r, 0), (r, L), (0, L)], m, grp, segs=n, closed=False, M=M @ Matrix.Translation(a) @ (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4(), **kw)
def turned(name, h, r, m, grp, M=I4, segs=14):
    """A turned leg or baluster of height h and greatest radius r: foot, vase, ring, neck."""
    P = [(0, 0), (0.75, 0), (0.75, 0.04), (0.5, 0.07), (0.62, 0.1), (1.0, 0.2), (0.9, 0.32), (0.5, 0.52), (0.45, 0.7), (0.7, 0.74), (0.45, 0.78), (0.6, 0.9), (0.8, 0.93), (0.8, 1.0), (0, 1.0)]
    return lathe(name, [(x * r, z * h) for x, z in P], m, grp, segs=segs, closed=False, M=M)
def moulding(name, prof, y0, y1, m, grp, M=I4, **kw):
    """A moulding running along Y: prof is its (x, z) outline."""
    return prism(name, prof, 'Y', y0, y1, m, grp, M=M, **kw)

def _strip(lo, hi, th):
    """A bent board: two polylines (bottom and top edge), given thickness along -x."""
    bm = bmesh.new(); n = len(lo); V4 = [[bm.verts.new(p) for p in lo], [bm.verts.new(p) for p in hi], [bm.verts.new((p[0] - th, p[1], p[2])) for p in lo], [bm.verts.new((p[0] - th, p[1], p[2])) for p in hi]]
    for i in range(n - 1):
        for a, b in ((0, 1), (1, 3), (3, 2), (2, 0)): bm.faces.new((V4[a][i], V4[a][i + 1], V4[b][i + 1], V4[b][i]))
    for i in (0, n - 1): bm.faces.new((V4[0][i], V4[1][i], V4[3][i], V4[2][i]))
    return bm


def bench(ASSETS, place={}):
    """ASSET=<name> in the environment: build that one asset alone in a studio, render two views (asset_<name>_0/1.png) and stop."""
    name = os.environ.get('ASSET')
    if not name: return
    ASSETS[name](place.get(name, I4))
    graph = bpy.context.evaluated_depsgraph_get()
    parts = [obj.evaluated_get(graph) for obj in scene.objects if obj.type == 'MESH']
    pts = [o.matrix_world @ Vector(corner) for o in parts for corner in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)]); c = (lo + hi) / 2; R = (hi - lo).length / 2
    mat('studio', (0.32, 0.32, 0.33), 0.6)
    box('studio_floor', c.x - 30, c.x + 30, c.y - 30, c.y + 30, lo.z - 0.02, lo.z, 'studio', 'props')
    for i, (az, el, e, col) in enumerate(((0.9, 0.9, 700, (1, 0.93, 0.85)), (-1.8, 0.5, 260, (0.8, 0.9, 1.0)), (2.9, 0.3, 200, (1, 0.8, 0.6)))):
        l = bpy.data.lights.new(f'key{i}', 'AREA'); l.energy = 0.35 * e * R * R; l.size = R * 1.5; l.color = col; o = bpy.data.objects.new(f'key{i}', l); COL.objects.link(o)
        o.location = c + Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el))) * R * 3; o.rotation_euler = (c - o.location).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.cameras.new('Bench'); cam.angle = math.radians(35); cam.clip_end = 500; co = bpy.data.objects.new('Bench', cam); scene.collection.objects.link(co); scene.camera = co
    scene.render.engine = 'CYCLES'; scene.cycles.samples = int(os.environ.get('SPP', 96)); scene.cycles.use_denoising = True; scene.cycles.device = 'GPU'
    prefs = bpy.context.preferences.addons['cycles'].preferences; DEV = os.environ.get('LOBBY_DEVICE', 'CUDA'); prefs.compute_device_type = DEV; prefs.get_devices()
    for d in prefs.devices: d.use = (d.type == DEV)
    scene.view_settings.view_transform = 'AgX'; scene.render.resolution_x, scene.render.resolution_y = 960, 720; scene.render.image_settings.file_format = 'PNG'
    # Keep the established distance unless a projected corner would clip (tall tripods in particular).
    frame = cam.view_frame(scene=scene)
    tx, ty = (max(abs(p[axis] / p.z) for p in frame) * .94 for axis in (0, 1))
    for i, (az, el) in enumerate(((-0.9, 0.35), (2.3, 0.2))):
        outward = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        rot = (-outward).to_track_quat('-Z', 'Y'); inv = rot.inverted()
        dist = max(R * 3.6, max(p.z + max(abs(p.x) / tx, abs(p.y) / ty) for p in (inv @ (v - c) for v in pts)))
        co.location = c + outward * dist; co.rotation_euler = rot.to_euler()
        scene.render.filepath = os.path.join(os.environ.get('ASSET_OUT', HERE), f'asset_{name}_{i}.png'); bpy.ops.render.render(write_still=True)
    print('ASSET', name, 'MESHES', len(parts))
    raise SystemExit

# ---- everything above this line is the shared kit: room_*.py scripts execute it and build their own room
exec(open(os.path.join(HERE, 'assets_projection.py')).read(), globals())
if os.environ.get('ASSET'):
    # Load bench hardware here without changing the normal scene's material setup order.
    exec(open(os.path.join(HERE, 'assets_tech.py')).read(), globals())
    # A representative door for inspecting the existing five-room builder in isolation.
    bench({**TECH, **ATRIUM_PROJECTION, 'pressure_door': lambda M: pressure_door(
        'door', M, 'center', 'ATRIUM', 'RING LINE  ·  STAIR', 'lobby', w=1.6, h=2.4)})

# ================================================================= ARCHITECTURE
def side_grp(s): return 'archR' if s > 0 else 'archL'

# ---- central polished floor (two pieces, each gets its own 4k bake)
quad('floor_near', [(-FX, Y0, 0), (FX, Y0, 0), (FX, FLOOR_SPLIT, 0), (-FX, FLOOR_SPLIT, 0)], 'floor', 'floorN')
quad('floor_far', [(-FX, FLOOR_SPLIT, 0), (FX, FLOOR_SPLIT, 0), (FX, STAIR_Y, 0), (-FX, STAIR_Y, 0)], 'floor', 'floorF')

# The two sides of the hall are deliberately not mirror images: each bay has its own job.
PROGRAM = {1: ['alcove', 'screen', 'screen', 'garden', 'alcove', 'screen', 'alcove'],          # the last bay stays low: the bulkhead doors are beyond it
           -1: ['alcove', 'screen', 'garden', 'screen', 'garden', 'screen', 'alcove']}
UPPER = {1: ['panel', 'banner', 'hatch', 'panel', 'banner', 'hatch', 'panel'],
         -1: ['panel', 'hatch', 'banner', 'hatch', 'panel', 'banner', 'hatch']}
TW = math.degrees(math.acos((WALL_Z - HC) / RL))        # where the lining meets the top of the service walls

def arc(s, r, t0, t1, n=None):
    """Points (x, z) on the circle of radius r about the tube axis, on side s; t = degrees round from the crown."""
    n = n or max(1, int(abs(t1 - t0) / 2.5))
    return [(s * r * math.sin(math.radians(t0 + (t1 - t0) * i / n)), HC + r * math.cos(math.radians(t0 + (t1 - t0) * i / n))) for i in range(n + 1)]
def shell(name, s, t0, t1, y0, y1, m=None, grp=None, depth=0.1, r=RL, **kw):
    """A curved panel on the hull: from t0 to t1 round the tube, standing `depth` proud of radius r."""
    return band(name, arc(s, r, t0, t1), arc(s, r - depth, t0, t1), y0, y1, m, grp, **kw)
def on_hull(s, t, d=0.0):
    """The point d inside the lining at angle t."""
    return arc(s, RL - d, t, t, 1)[0]

for s in (1, -1):
    g = side_grp(s)
    sx = lambda x: s * x
    # ---- Stepped side platforms
    # Each tread overhangs its riser; the step lights hide under the nosing.
    prof = [(sx(FX), 0)]
    STEPS = ((FX, 0.15), (6.2, 0.30), (6.5, PLAT_Z))
    for xx, zz in STEPS:
        prof += [(sx(xx), zz - 0.04), (sx(xx - 0.04), zz - 0.04), (sx(xx - 0.04), zz)]
    prof += [(sx(W), PLAT_Z), (sx(W), 0)]
    prism(f'platform_{g}', prof, 'Y', Y0, Y1, 'plat', g)
    for i, (xx, zz) in enumerate(STEPS):
        box(f'stepled_{g}{i}', sx(xx - 0.032), sx(xx - 0.006), Y0, STAIR_Y if i == 0 else Y1, zz - 0.048, zz - 0.04, em='step')
    # ---- Hull lining and wall base planes
    quad(f'wall_{g}', [(sx(W), Y0, 0), (sx(W), Y1, 0), (sx(W), Y1, WALL_Z + 0.3), (sx(W), Y0, WALL_Z + 0.3)], 'wall', g)
    shell(f'hull_{g}', s, 0, TW + 3, Y0, Y1, 'ceil', 'archC', depth=-0.1)

    # ---- Balcony slab, balustrade and handrail
    # Brass inlay and wash light under the taper; frameless glass on slim stanchions.
    TOP = MEZ_Z + 0.4
    prism(f'mezz_{g}', [(sx(7.7), MEZ_Z), (sx(W), MEZ_Z), (sx(W), TOP), (sx(6.85), TOP), (sx(6.85), TOP - 0.1), (sx(7.05), MEZ_Z + 0.12)],
          'Y', Y0, Y1, 'rib', g, bevel=0.012)
    box(f'inlay_{g}', sx(6.838), sx(6.85), Y0, Y1, TOP - 0.07, TOP - 0.03, 'brass', g)
    box(f'soffitled_{g}', sx(7.27), sx(7.33), Y0, Y1, MEZ_Z + 0.056, MEZ_Z + 0.066, em='step')
    box(f'shoe_{g}', sx(6.9), sx(7.02), Y0, Y1, TOP, TOP + 0.1, 'wall2', g, bevel=0.01)
    y = Y0 + 1.0
    while y < Y1:
        box(f'post_{g}', sx(6.975), sx(6.997), y - 0.03, y + 0.03, TOP + 0.1, 5.6, 'dark', g)
        box(f'postcap_{g}', sx(6.94), sx(6.997), y - 0.035, y + 0.035, 5.56, 5.62, 'dark', g)
        y += 2.0
    tube(f'rail_{g}', sx(6.96), 5.66, 0.032, Y0, Y1, 'brass', g)
    quad(f'FX_glass_{g}', [(sx(6.96), Y0, TOP + 0.1), (sx(6.96), Y1, TOP + 0.1), (sx(6.96), Y1, 5.63), (sx(6.96), Y0, 5.63)],
         'chrome', fx='glass', uv=True)

    # ---- Hull ring frames and balcony brackets
    for k, ry in enumerate(RIB_Y):
        gg = 'back' if ry < CAM_POS.y else g
        band(f'rib_{g}{k}', arc(s, RIB_OUT, 103.5, 0), arc(s, RIB_IN, 103.5, 0), ry - 0.3, ry + 0.3, 'rib', gg, bevel=0.03)
        band(f'ribled_{g}{k}', arc(s, RIB_IN, 100.5, 0), arc(s, RIB_IN - 0.02, 100.5, 0), ry - 0.04, ry + 0.04, em=em_ramp('ice', k, ry, 0.3, 2.3))
        prism(f'bracket_{g}{k}', [(sx(9.6), MEZ_Z), (sx(7.75), MEZ_Z), (sx(7.75), MEZ_Z - 0.07), (sx(9.6), MEZ_Z - 0.8)], 'Y', ry - 0.09, ry + 0.09, 'rib', gg, bevel=0.015)

    # ---- service run along the hull on the left side only: a duct and two pipes on hangers
    if s < 0:
        tube('duct', *on_hull(s, 53, 0.36), 0.2, Y0, Y1, 'wall2', 'archC', n=16)
        tube('pipe_a', *on_hull(s, 48.6, 0.2), 0.07, Y0, Y1, 'brass', 'archC')
        tube('pipe_b', *on_hull(s, 46.6, 0.17), 0.045, Y0, Y1, 'chrome', 'archC')
        for yc in BAYS:
            for yy in (yc - 0.9, yc + 0.9):
                prism('hanger', [on_hull(s, 55, 0), on_hull(s, 45.5, 0), on_hull(s, 45.5, 0.1), on_hull(s, 51, 0.62), on_hull(s, 55, 0.62)], 'Y', yy - 0.02, yy + 0.02, 'dark', 'archC')

    # ---- Lower wall bays
    for bi, yc in enumerate(BAYS):
        gg = 'back' if yc < CAM_POS.y else g
        kind = PROGRAM[s][bi]; z0 = PLAT_Z
        if kind == 'screen':
            # ---- Departure screens and planters
            box(f'bezel_{g}{bi}', sx(9.9), sx(W), yc - 1.5, yc + 1.5, 1.25, 3.35, 'dark', gg, bevel=0.02)
            quad(f'FX_screen_{g}{bi}', [(sx(9.893), yc + s * 1.4, 1.35), (sx(9.893), yc - s * 1.4, 1.35),
                                         (sx(9.893), yc - s * 1.4, 3.25), (sx(9.893), yc + s * 1.4, 3.25)],
                 'lum_screen', fx='screen', uv=True)
            # planter + plants
            px0, px1 = 6.75, 7.25
            box(f'planter_{g}{bi}', sx(px0), sx(px1), yc - 1.4, yc + 1.4, PLAT_Z, PLAT_Z + 0.5, 'white', 'props', bevel=0.03)
            box(f'soil_{g}{bi}', sx(px0 + 0.04), sx(px1 - 0.04), yc - 1.36, yc + 1.36, PLAT_Z + 0.44, PLAT_Z + 0.47, 'soil', 'props')
            bm = bmesh.new()
            for pi_ in range(7):
                cx = sx((px0 + px1) / 2 + random.uniform(-0.08, 0.08)); cy = yc - 1.15 + pi_ * 2.3 / 6 + random.uniform(-0.08, 0.08)
                for li in range(13):
                    ph = random.uniform(0, 2 * pi); L = random.uniform(0.55, 1.25); lean = random.uniform(0.05, 0.5)
                    wd = random.uniform(0.035, 0.06); tw = random.uniform(-0.6, 0.6)
                    prev = None
                    for sgi in range(6):
                        t = sgi / 5
                        c = Vector((cx + math.cos(ph) * (0.03 + lean * t * t * L), cy + math.sin(ph) * (0.03 + lean * t * t * L),
                                    PLAT_Z + 0.46 + L * t * (1 - 0.25 * lean * t)))
                        a = ph + pi / 2 + tw * t
                        ww = wd * (1 - t ** 2.2) + 0.002
                        d = Vector((math.cos(a), math.sin(a), 0)) * ww
                        cur = (bm.verts.new(c - d), bm.verts.new(c + d))
                        if prev: bm.faces.new((prev[0], prev[1], cur[1], cur[0]))
                        prev = cur
            for f in bm.faces: f.smooth = True
            finish(f'plants_{g}{bi}', bm, 'leaf', 'props')
        elif kind == 'alcove':
            # ---- Alcove seating, side tables and surrounds
            box(f'alcpanel_{g}{bi}', sx(9.74), sx(9.84), yc - 1.3, yc + 1.3, 0.8, 3.85, 'wall2', gg, bevel=0.02)
            for yy in (yc - 1.18, yc + 1.18):
                box(f'alcled_{g}{bi}', sx(9.9), sx(9.94), yy - 0.03, yy + 0.03, 0.9, 3.75, em='amber')
            box(f'alcledt_{g}{bi}', sx(9.9), sx(9.94), yc - 1.18, yc + 1.18, 3.7, 3.75, em='amber')
            box(f'sofa_base_{g}{bi}', sx(8.25), sx(9.2), yc - 1.25, yc + 1.25, z0 + 0.06, z0 + 0.2, 'dark', 'props')
            box(f'sofa_seat_{g}{bi}', sx(8.2), sx(9.05), yc - 1.2, yc + 1.2, z0 + 0.2, z0 + 0.46, 'sofa', 'props', bevel=0.06, seg=3)
            box(f'sofa_back_{g}{bi}', sx(9.0), sx(9.28), yc - 1.3, yc + 1.3, z0 + 0.2, z0 + 0.95, 'sofa', 'props', bevel=0.07, seg=3)
            for yy in (yc - 1.3, yc + 1.3):
                box(f'sofa_arm_{g}{bi}', sx(8.2), sx(9.28), yy - 0.11, yy + 0.11, z0 + 0.2, z0 + 0.66, 'sofa', 'props', bevel=0.06, seg=3)
            lathe(f'table_{g}{bi}', [(0, 0.4), (0.42, 0.4), (0.45, 0.37), (0.3, 0.04), (0.3, 0.0), (0, 0)], 'white', 'props', segs=48,
                  M=T((sx(7.45), yc, z0)))
        elif kind == 'garden':
            # ---- Grove planters, uplights and garden benches
            c = Vector((sx(8.25), yc, z0))
            lathe(f'treepot_{g}{bi}', [(0, 0.5), (0.86, 0.5), (0.95, 0.44), (0.8, 0.0), (0, 0)], 'white', 'props', segs=48, closed=False, M=T(c))
            lathe(f'treesoil_{g}{bi}', [(0, 0.46), (0.84, 0.46), (0.84, 0.47), (0, 0.47)], 'soil', 'props', segs=32, closed=False, M=T(c))
            # a grove of tall grasses (same family as the planters, three times the height)
            bm = bmesh.new()
            for pi_ in range(22):
                a = random.uniform(0, 2 * pi); rr = 0.7 * math.sqrt(random.random())
                cx, cy = c.x + math.cos(a) * rr, c.y + math.sin(a) * rr
                for li in range(9):
                    ph = random.uniform(0, 2 * pi); L = random.uniform(1.5, 2.9) * (1.0 - 0.3 * rr); lean = random.uniform(0.03, 0.22)
                    wd = random.uniform(0.04, 0.075); tw = random.uniform(-0.8, 0.8)
                    prev = None
                    for sgi in range(8):
                        t = sgi / 7
                        p = Vector((cx + math.cos(ph) * (0.03 + lean * t * t * L), cy + math.sin(ph) * (0.03 + lean * t * t * L), z0 + 0.46 + L * t * (1 - 0.2 * lean * t)))
                        aa = ph + pi / 2 + tw * t; ww = wd * (1 - t ** 2.2) + 0.002
                        d = Vector((math.cos(aa), math.sin(aa), 0)) * ww
                        cur = (bm.verts.new(p - d), bm.verts.new(p + d))
                        if prev: bm.faces.new((prev[0], prev[1], cur[1], cur[0]))
                        prev = cur
            for f in bm.faces: f.smooth = True
            finish(f'grove_{g}{bi}', bm, 'leaf', 'props')
            for d in (-1, 1):
                lathe(f'treeup_{g}{bi}', [(0, 0.0), (0.05, 0.0), (0.05, 0.01), (0, 0.01)], em='warm', segs=12, closed=False, M=T(c + Vector((0.3 * d, 0.45 * d, 0.475))))
            box(f'bench_{g}{bi}', sx(9.25), sx(9.72), yc - 1.2, yc + 1.2, z0 + 0.3, z0 + 0.42, 'white', 'props', bevel=0.03)
            box(f'benchleg_{g}{bi}', sx(9.35), sx(9.62), yc - 1.0, yc + 1.0, z0, z0 + 0.3, 'dark', 'props')
            box(f'benchpad_{g}{bi}', sx(9.28), sx(9.7), yc - 1.15, yc + 1.15, z0 + 0.42, z0 + 0.48, 'sofa', 'props', bevel=0.02)
            box(f'gardenpanel_{g}{bi}', sx(9.8), sx(9.86), yc - 1.3, yc + 1.3, 0.9, 3.8, 'wall2', gg, bevel=0.02)
        # ---- Balcony downlights
        for yy in (yc - 0.9, yc + 0.9):
            lathe(f'down_{g}{bi}', [(0, 0.0), (0.07, 0.0), (0.07, 0.012), (0, 0.012)], em='warm', segs=16, M=T((sx(8.3), yy, MEZ_Z - 0.012)))

        # ---------- the hull above the balcony: a dressed band (banners, fins, service hatches) under a cove wash
        up = UPPER[s][bi]
        shell(f'uppanel_{g}{bi}', s, 60.5, 75.5, yc - 1.55, yc + 1.55, 'wall2', gg)
        shell(f'covelip_{g}{bi}', s, 58.9, 59.7, yc - 1.55, yc + 1.55, 'wall2', gg, depth=0.26)
        shell(f'cove_{g}{bi}', s, 59.8, 60.1, yc - 1.5, yc + 1.5, em='step', depth=0.04, r=RL - 0.14)
        if up == 'banner':                                                       # cloth hangs plumb, so it stands clear of the curving hull
            col = 'banner_o' if (bi + (s > 0)) % 2 else 'banner_n'; bx = on_hull(1, 61)[0] - 0.14
            box(f'banner_{g}{bi}', sx(bx - 0.015), sx(bx), yc - 0.85, yc + 0.85, 4.95, 7.05, col, gg)
            tube(f'bannerrod_{g}{bi}', sx(bx - 0.008), 7.07, 0.025, yc - 0.95, yc + 0.95, 'brass', gg, n=8)
            Mb = T((sx(bx - 0.02), yc, 6.2), (0, -s * pi / 2, 0))                                    # emblem: ring and star
            lathe(f'emblem_{g}{bi}', [(0.36, 0), (0.45, 0), (0.45, 0.006), (0.36, 0.006)], 'white', gg, segs=48, M=Mb)
            lathe(f'emblemdot_{g}{bi}', [(0, 0), (0.1, 0), (0.1, 0.006), (0, 0.006)], 'white', gg, segs=24, closed=False, M=Mb)
            box(f'bannerbar_{g}{bi}', sx(bx - 0.023), sx(bx - 0.015), yc - 0.6, yc + 0.6, 5.25, 5.31, 'white', gg)
        elif up == 'hatch':                                                      # service hatch into the space between lining and hull
            shell(f'hatch_{g}{bi}', s, 63.5, 72.5, yc - 1.1, yc + 1.1, 'dark', gg, depth=0.14)
            for yy in (yc - 0.55, yc + 0.55):
                shell(f'hatchslit_{g}{bi}', s, 65.5, 67.0, yy - 0.3, yy + 0.3, 'lum_cool', gg, depth=0.15)
            shell(f'hatchpull_{g}{bi}', s, 70.6, 71.0, yc - 0.35, yc + 0.35, 'brass', gg, depth=0.18)
        else:
            for yy in (yc - 0.8, yc + 0.8):
                shell(f'fin_{g}{bi}', s, 61.5, 74.5, yy - 0.05, yy + 0.05, 'rib', gg, depth=0.22)
        # ---------- the crown: lining panels between the frames, light lines and spots set into them
        lit = em_ramp('white', bi, yc, 0.4, 2.8)
        shell(f'crown_{g}{bi}', s, 12.5, 52, yc - 1.55, yc + 1.55, 'wall', 'archC', depth=0.09)
        shell(f'crownmid_{g}{bi}', s, 0, 8.3, yc - 1.55, yc + 1.55, 'wall', 'archC', depth=0.12)
        shell(f'chled_{g}{bi}', s, 33.6, 34.3, yc - 1.4, yc + 1.4, em=lit, depth=0.015, r=RL - 0.085)
        shell(f'ceilled_{g}{bi}', s, 8.9, 9.6, yc - 1.6, yc + 1.6, em=lit, depth=0.03)
        for t in (19, 29):
            for yy in (yc - 0.85, yc + 0.85):
                shell(f'spot_{g}{bi}', s, t - 0.29, t + 0.29, yy - 0.05, yy + 0.05, em='warm', depth=0.02)

    # ---- floor: a brass strip let into the stone, with small in-ground marker lights that brighten towards the portal
    box(f'floorinlay_{g}', sx(4.57), sx(4.63), Y0, STAIR_Y, 0.0, 0.003, 'brass', 'center')
    for i in range(14):
        y = -6.0 + 2.0 * i
        if abs(math.hypot(4.6, y - DAIS.y) - 4.34) < 0.3: continue           # where the strip meets the ring round the dais
        lathe(f'marker_{g}{i}', [(0, 0.004), (0.036, 0.004), (0.036, 0.0), (0, 0.0)], em=em_ramp('mark', i, y, 0.5, 5.5), segs=12, closed=False, M=T((sx(4.6), y, 0)))
        lathe(f'markerbezel_{g}{i}', [(0.036, 0.0045), (0.06, 0.0045), (0.06, 0.0), (0.036, 0.0)], 'dark', 'center', segs=16, closed=False, M=T((sx(4.6), y, 0)))

# ---- Lift lobby bulkhead behind the camera
def profile_pts():
    return [(-W, 0), (W, 0), (W, WALL_Z)] + arc(1, RL, TW, 0) + arc(-1, RL, 0, TW)[1:] + [(-W, WALL_Z)]
bm = bmesh.new(); bm.faces.new([bm.verts.new((x, Y0, z)) for x, z in profile_pts()])
face_in(bm); finish('backwall', bm, 'wall', 'back', keep_normals=True)
box('backdoor', -2.4, 2.4, Y0, Y0 + 0.12, 0, 4.2, 'wall2', 'back', bevel=0.03)
for xx in (-3.6, 3.6):
    box('backlum', xx - 0.5, xx + 0.5, Y0, Y0 + 0.05, 0.6, 6.5, 'lum_cool', 'back')
box('backlum_t', -2.2, 2.2, Y0, Y0 + 0.05, 4.6, 5.2, 'lum_cool', 'back')

# ---- spinward bulkhead. In its middle, the Oculus: a ring-framed optic 9 m across (radial mesh around it)
def ray_poly(c, a, poly):
    d = (math.cos(a), math.sin(a)); best = 1e9
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        ex, ez = q[0] - p[0], q[1] - p[1]
        den = d[0] * ez - d[1] * ex
        if abs(den) < 1e-9: continue
        t = ((p[0] - c[0]) * ez - (p[1] - c[1]) * ex) / den
        u = ((p[0] - c[0]) * d[1] - (p[1] - c[1]) * d[0]) / den
        if t > 0 and -1e-6 <= u <= 1 + 1e-6: best = min(best, t)
    return (c[0] + d[0] * best, c[1] + d[1] * best)
poly = profile_pts(); c2 = (PORTAL_C.x, PORTAL_C.z)
angs = [2 * pi * i / 128 for i in range(128)] + [math.atan2(p[1] - c2[1], p[0] - c2[0]) % (2 * pi) for p in poly]
angs = sorted(set(round(a, 6) for a in angs))
for yy, nm in ((Y1, 'endwall'), (Y1 + 1.2, 'endwall_out')):
    bm = bmesh.new()
    inn = [bm.verts.new((c2[0] + (PORTAL_R + 0.3) * math.cos(a), yy, c2[1] + (PORTAL_R + 0.3) * math.sin(a))) for a in angs]
    out = []
    for a in angs:
        p = ray_poly(c2, a, poly); out.append(bm.verts.new((p[0], yy, p[1])))
    for i in range(len(angs)):
        j = (i + 1) % len(angs)
        bm.faces.new((inn[i], inn[j], out[j], out[i]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); face_in(bm)
    finish(nm, bm, 'wall', 'archC' if nm == 'endwall' else 'back', keep_normals=True)

# ---- Mission lettering either side of the portal
def text(name, body, size, x, z, em='sign', spacing=1.12):
    return text3d(name, body, size, T((x, Y1 - 0.03, z), (pi / 2, 0, 0)), em, spacing)
text('sign_l1', 'AURORA', 0.58, -7.2, 6.72)
text('sign_l2', 'ARK ONE', 0.3, -7.2, 6.26, spacing=1.5)
text('sign_r1', 'AD ASTRA', 0.48, 7.2, 6.74)
text('sign_r2', 'FOR ALL OF US', 0.26, 7.2, 6.28, spacing=1.25)
# what the big ring is: not a window (this wall faces the next compartment, and the ring turns twice a minute)
text('sign_l3', 'OCULUS  01', 0.2, -7.3, 5.8, spacing=1.6)
text('sign_r3', 'RELAYED FROM THE HUB', 0.17, 7.3, 5.82, spacing=1.4)

# ---- Oculus frame, clamps and dial marks
MP = T(PORTAL_C, (pi / 2, 0, 0))   # local z -> world -y (towards the hall)
R = PORTAL_R
lathe('portal_frame', [(R, 0.3), (R + 0.12, 0.45), (R + 0.62, 0.45), (R + 0.78, 0.3), (R + 0.78, -0.05), (R + 0.4, -1.25), (R, -1.25)],
      'rib', 'center', segs=160, M=MP)
lathe('portal_led', [(R + 0.33, 0.45), (R + 0.41, 0.45), (R + 0.41, 0.465), (R + 0.33, 0.465)], em='ice', segs=160, M=MP)
lathe('portal_led_in', [(R - 0.012, -0.35), (R, -0.35), (R, -0.45), (R - 0.012, -0.45)], em='cyan', segs=160, M=MP)
lathe('portal_trim', [(R + 0.78, 0.3), (R + 0.9, 0.3), (R + 0.9, 0.0), (R + 0.78, 0.0)], 'copper', 'center', segs=160, M=MP)
for i in range(12):
    a = 2 * pi * (i + 0.5) / 12
    Mc = MP @ Matrix.Rotation(a, 4, 'Z')
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=T((R + 0.42, 0, 0.36)) @ Matrix.Diagonal((0.95, 0.5, 0.36, 1)), verts=bm.verts)
    finish(f'portal_clamp{i}', bm, 'wall2', 'center', bevel=0.03, M=Mc)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=T((R + 1.55, 0, 0.012)) @ Matrix.Diagonal((0.9, 0.035, 0.03, 1)), verts=bm.verts)
    finish(f'portal_tick{i}', bm, None, em='cyan', M=MP @ Matrix.Rotation(2 * pi * i / 12, 4, 'Z'))

# ---- Oculus barrel and baffles
lathe('oculus_barrel', [(R, -1.25), (R, -3.4), (R + 0.05, -3.4), (R + 0.05, -1.25)], 'dark', 'center', segs=96, M=MP)
for depth, lip in ((-2.2, 0.16), (-3.4, 0.34)):
    lathe(f'oculus_baffle{-depth}', [(R - lip, depth), (R + 0.05, depth), (R + 0.05, depth - 0.04), (R - lip, depth - 0.04)], 'dark', 'center', segs=96, M=MP)
# ---- Door recesses either side of the stair
# On to the next compartment, and down to the Ring Line that runs under every deck.
for sx_, title, sub_, to, stops in ((1, 'LOUNGE', 'SPINWARD  ·  COMPARTMENT 6', 'about', None),
                                    (-1, 'RING LINE', 'STAIR DOWN  ·  ALL COMPARTMENTS', '', [['NAVIGATION', 'experience'], ['FABRICATION', 'projects'], ['LOUNGE', 'about'], ['LIBRARY', 'writing'], ['COMMS', '']])):
    box(f'doorrecess{sx_}', sx_ * 8.2 - 1.5, sx_ * 8.2 + 1.5, Y1 - 0.2, Y1, PLAT_Z, 3.95, 'dark', 'center', bevel=0.02)
    pressure_door(f'door{sx_}', T((sx_ * 8.2, Y1 - 0.22, PLAT_Z), (0, 0, -pi / 2)), 'center', title, sub_, to, stops=stops)

# ---- grand stair + viewing platform under the Oculus
pts = [(STAIR_Y, 0)]
for i in range(5):
    y = STAIR_Y + 0.5 * i; z = 0.16 * (i + 1)
    pts += [(y, z - 0.04), (y - 0.04, z - 0.04), (y - 0.04, z), (y + 0.5, z)]
pts[-1] = (Y1, 0.8); pts.append((Y1, 0))
prism('stairs', pts, 'X', -FX, FX, 'stone', 'center')
for i in range(5):
    y = STAIR_Y + 0.5 * i; z = 0.16 * (i + 1)
    box(f'stairled{i}', -FX + 0.1, FX - 0.1, y - 0.032, y - 0.006, z - 0.048, z - 0.04, em='stair')

# ---- reception dais, desk, hologram pedestal
MD = T(DAIS)
# the dais floats: its edge overhangs a recessed plinth and the light is hidden in the shadow gap
lathe('dais', [(0, 0.14), (3.6, 0.14), (3.6, 0.09), (3.48, 0.09), (3.48, 0)], 'plat', 'center', segs=160, closed=False, M=MD)
lathe('dais_led', [(3.5, 0.075), (3.58, 0.075), (3.58, 0.085), (3.5, 0.085)], em='stair', segs=160, M=MD)
lathe('floor_ring', [(4.3, 0.0), (4.38, 0.0), (4.38, 0.003), (4.3, 0.003)], 'brass', 'center', segs=160, M=MD)
for di, (a0, a1) in enumerate(((-56, 56), (124, 236))):
    a_reception_desk(MD, a0=math.radians(a0), a1=math.radians(a1), index=di)
a_projector(MD)
lathe('holo_floor_ring', [(1.15, 0.14), (1.19, 0.14), (1.19, 0.143), (1.15, 0.143)], 'brass', 'center', segs=96, M=MD)

# ---- orrery chandelier: three nested gimbal rings, each lit along part of its length.
# Rings tagged A turn one way about the vertical axis, B the other (see bake.py: their light is baked per phase).
CH_C = Vector((DAIS.x, DAIS.y, 8.15))
a_orrery(Matrix.Translation(CH_C), stem_rise=H - CH_C.z)

# ================================================================= CONCOURSE DETAIL (assets_tech.py): what a working terminal accumulates
exec(open(os.path.join(HERE, 'assets_tech.py')).read(), globals())
a_kiosk(T((7.0, 3.0, PLAT_Z)) @ Matrix.Rotation(pi, 4, 'Z')); a_kiosk(T((-7.0, 15.0, PLAT_Z)))
a_bench_hall(T((7.1, 9.8, PLAT_Z)) @ Matrix.Rotation(pi, 4, 'Z') @ T((0, -2.4, 0))); a_bench_hall(T((-7.1, -2.2, PLAT_Z)))
a_luggage(T((-7.3, 7.2, PLAT_Z), (0, 0, 0.5))); a_luggage(T((7.4, 18.7, PLAT_Z), (0, 0, 2.4)))
a_floorhatch(T((-7.2, 11.0, PLAT_Z)), 'props'); a_floorhatch(T((7.2, -1.0, PLAT_Z)), 'props')
for y in (6.2, 8.2): a_stanchion(T((6.3, y, PLAT_Z)), 'props', L=2.0)

# ================================================================= PEOPLE
# Crew and families gathered at the window for a last look at Earth. They are seen from behind, backlit by the
# planet, so simple skinned figures read well. (Skin modifier over a joint graph -> smooth mannequin bodies.)
mat('suit_orange', (0.78, 0.2, 0.03), 0.7)
mat('suit_white', (0.72, 0.73, 0.75), 0.6)
mat('suit_navy', (0.035, 0.06, 0.14), 0.65)
mat('suit_grey', (0.2, 0.21, 0.23), 0.7)
mat('kid_yellow', (0.85, 0.55, 0.06), 0.7)
mat('kid_red', (0.6, 0.06, 0.05), 0.7)
for i, c in enumerate(((0.62, 0.42, 0.32), (0.35, 0.22, 0.15), (0.75, 0.56, 0.45), (0.2, 0.12, 0.08))):
    mat(f'skin{i}', c, 0.55)
mat('hair', (0.03, 0.022, 0.018), 0.6)
_pcount = [0]
def person(x, y, z, h=1.75, yaw=0.0, pose='stand', suit='suit_navy', skin=0, lean=0.0):
    """Figure standing at (x, y, z) facing +Y rotated by yaw (degrees)."""
    _pcount[0] += 1; nm = f'person{_pcount[0]}'
    J = {'pelvis': ((0, 0, 0.95), (0.15, 0.105)), 'waist': ((0, 0.005, 1.12), (0.135, 0.095)), 'chest': ((0, 0, 1.33), (0.17, 0.11)),
         'neck': ((0, 0.01, 1.49), (0.05, 0.05)), 'headb': ((0, 0.015, 1.56), (0.05, 0.05)),
         'shL': ((-0.2, 0, 1.43), (0.058, 0.058)), 'elL': ((-0.25, 0.02, 1.14), (0.045, 0.045)), 'haL': ((-0.255, 0.07, 0.87), (0.036, 0.03)),
         'shR': ((0.2, 0, 1.43), (0.058, 0.058)), 'elR': ((0.25, 0.02, 1.14), (0.045, 0.045)), 'haR': ((0.255, 0.07, 0.87), (0.036, 0.03)),
         'hipL': ((-0.09, 0, 0.9), (0.092, 0.092)), 'knL': ((-0.1, 0.02, 0.5), (0.062, 0.062)), 'anL': ((-0.105, -0.01, 0.09), (0.044, 0.044)), 'toL': ((-0.115, 0.13, 0.04), (0.04, 0.034)),
         'hipR': ((0.09, 0, 0.9), (0.092, 0.092)), 'knR': ((0.1, 0.02, 0.5), (0.062, 0.062)), 'anR': ((0.105, -0.01, 0.09), (0.044, 0.044)), 'toR': ((0.115, 0.13, 0.04), (0.04, 0.034))}
    def setj(k, p): J[k] = (p, J[k][1])
    if pose == 'point':          # right arm raised towards the window
        setj('elR', (0.27, 0.2, 1.4)); setj('haR', (0.3, 0.47, 1.6))
    elif pose == 'holdL':        # left hand lowered to a child
        setj('elL', (-0.3, 0.02, 1.17)); setj('haL', (-0.4, 0.03, 0.95))
    elif pose == 'holdR':
        setj('elR', (0.3, 0.02, 1.17)); setj('haR', (0.4, 0.03, 0.95))
    elif pose == 'kidR':         # child reaching up to an adult on the right
        setj('elR', (0.3, 0.02, 1.5)); setj('haR', (0.42, 0.03, 1.72))
    elif pose == 'hips':
        setj('elL', (-0.33, -0.03, 1.2)); setj('haL', (-0.2, 0.0, 1.02)); setj('elR', (0.33, -0.03, 1.2)); setj('haR', (0.2, 0.0, 1.02))
    elif pose == 'arm':          # arm around the neighbour on the right
        setj('elR', (0.4, 0.03, 1.36)); setj('haR', (0.62, 0.06, 1.38))
    elif pose == 'walk':
        setj('knL', (-0.1, 0.16, 0.52)); setj('anL', (-0.105, 0.2, 0.1)); setj('toL', (-0.115, 0.34, 0.05))
        setj('knR', (0.1, -0.08, 0.5)); setj('anR', (0.105, -0.26, 0.12)); setj('toR', (0.115, -0.14, 0.04))
        setj('elL', (-0.25, -0.08, 1.15)); setj('haL', (-0.25, -0.12, 0.88)); setj('elR', (0.25, 0.1, 1.16)); setj('haR', (0.25, 0.22, 0.92))
    E = [('pelvis', 'waist'), ('waist', 'chest'), ('chest', 'neck'), ('neck', 'headb'), ('chest', 'shL'), ('shL', 'elL'), ('elL', 'haL'),
         ('chest', 'shR'), ('shR', 'elR'), ('elR', 'haR'), ('pelvis', 'hipL'), ('hipL', 'knL'), ('knL', 'anL'), ('anL', 'toL'),
         ('pelvis', 'hipR'), ('hipR', 'knR'), ('knR', 'anR'), ('anR', 'toR')]
    bm = bmesh.new(); lay = bm.verts.layers.skin.verify(); V = {}
    for k, (p, r) in J.items():
        v = bm.verts.new(p); v[lay].radius = (r[0] * 1.16, r[1] * 1.2); v[lay].use_root = (k == 'pelvis'); V[k] = v
    for a, b in E: bm.edges.new((V[a], V[b]))
    me = bpy.data.meshes.new(nm); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(nm, me); COL.objects.link(ob)
    ob.modifiers.new('skin', 'SKIN'); sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    me.materials.append(MAT[suit]); ob['grp'] = 'people'
    sc = h / 1.75
    M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.radians(lean), 4, 'X') @ Matrix.Scale(sc, 4)
    ob.matrix_world = M
    # head + hair cap
    hs = 1.0 if h > 1.4 else 1.22        # children have proportionally larger heads
    for part, rad, off, mname in (('head', 0.112 * hs, (0, 0.02, 1.665 + 0.02 * (hs - 1)), f'skin{skin}'), ('hair', 0.118 * hs, (0, -0.012, 1.69 + 0.02 * (hs - 1)), 'hair')):
        b2 = bmesh.new(); bmesh.ops.create_uvsphere(b2, u_segments=20, v_segments=12, radius=rad)
        bmesh.ops.transform(b2, matrix=Matrix.Translation(off) @ Matrix.Diagonal((0.92, 1.0, 1.14 if part == 'head' else 0.95, 1)), verts=b2.verts)
        for f in b2.faces: f.smooth = True
        m2 = bpy.data.meshes.new(f'{nm}_{part}'); b2.to_mesh(m2); b2.free()
        o2 = bpy.data.objects.new(f'{nm}_{part}', m2); COL.objects.link(o2); m2.materials.append(MAT[mname]); o2['grp'] = 'people'
        o2.matrix_world = M
    return ob

def case(x, y, z, yaw=0, w=0.42, d=0.26, hh=0.62, m='suit_grey'):
    _pcount[0] += 1
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, hh / 2)) @ Matrix.Diagonal((w, d, hh, 1)), verts=bm.verts)
    ob = finish(f'case{_pcount[0]}', bm, m, 'people', bevel=0.035, seg=3, M=Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(yaw), 4, 'Z'))
    box(f'casehandle{_pcount[0]}', x - 0.09, x + 0.09, y - 0.012, y + 0.012, z + hh, z + hh + 0.3, 'chrome', 'people')
    return ob

if PEOPLE:
    PZ = 0.8                                   # viewing platform under the portal
    person(-3.55, 24.7, PZ, 1.8, 8, 'hips', 'suit_navy', 1)
    person(-2.35, 24.9, PZ, 1.72, -4, 'holdL', 'suit_orange', 0)
    person(-2.83, 24.95, PZ, 1.08, 6, 'kidR', 'kid_yellow', 0)
    case(-1.75, 24.55, PZ, 12, m='suit_white')
    person(-1.25, 25.0, PZ, 1.66, 3, 'stand', 'suit_white', 2)
    person(1.3, 24.95, PZ, 1.83, -6, 'arm', 'suit_orange', 3)
    person(1.86, 25.0, PZ, 1.68, 5, 'stand', 'suit_grey', 2, lean=0)
    person(2.9, 24.75, PZ, 1.77, -12, 'point', 'suit_navy', 0)
    person(3.45, 24.9, PZ, 1.22, -8, 'stand', 'kid_red', 1)
    case(4.1, 24.6, PZ, -20)
    person(3.9, 25.05, PZ, 1.7, -3, 'holdL', 'suit_white', 3)
    # a late arrival climbing the stairs, and two crew talking by the seating
    person(-0.9, 22.3, 0.48, 1.78, 4, 'walk', 'suit_orange', 2, lean=-4)
    person(-7.75, 16.9, PLAT_Z, 1.8, -70, 'hips', 'suit_navy', 3)
    person(-7.1, 17.45, PLAT_Z, 1.68, 150, 'stand', 'suit_orange', 0)
    case(-7.6, 17.9, PLAT_Z, 30, m='suit_white')
    person(7.5, 12.6, PLAT_Z, 1.74, 95, 'walk', 'suit_white', 1, lean=-3)
    # a parent and child crossing the hall towards the window
    person(-2.55, 12.6, 0.0, 1.76, -3, 'holdL', 'suit_white', 1)
    person(-3.04, 12.68, 0.0, 1.12, 4, 'kidR', 'kid_red', 1)

# ================================================================= OUTSIDE (Earth seen from low orbit, stars)
def view_dir(az, el):
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))

# The station flies ~400 km up: Earth is not a ball in the window, it is a huge curved horizon.
EARTH_ANG = math.radians(64.0)          # angular radius of the planet as seen from the hall
EARTH_DIST = 1000.0                     # scene units; only angles matter
_d0 = (PORTAL_C - CAM_POS).normalized()
_right = _d0.cross(Vector((0, 0, 1))).normalized(); _up = _right.cross(_d0)
_phi = math.radians(258)                # planet fills the bottom of the window, horizon tilted a little
_o = math.cos(_phi) * _right + math.sin(_phi) * _up
_theta = EARTH_ANG - math.radians(1.4)  # horizon a little above the centre of the portal, ~3.5 degrees under the sun
EARTH_C = CAM_POS + (math.cos(_theta) * _d0 + math.sin(_theta) * _o) * EARTH_DIST
EARTH_R = EARTH_DIST * math.sin(EARTH_ANG)
assert math.degrees(SUN_DIR.angle((EARTH_C - CAM_POS))) > math.degrees(EARTH_ANG) + 2.5, 'sun would be behind the planet'
TEXD = os.path.join(HERE, 'textures_dl')
E_SUN = 9.0 
NIGHT_GAIN = 0.85                       # city lights: the part of home that is still visible in the dark                            # brightness of sunlit ground relative to the interior lighting

def earth_material():
    """Analytic sun shading as emission (so it both renders as backdrop and lights the hall as earthshine)."""
    m = bpy.data.materials.new('earth'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); g = NT(nt)
    out = g.node('ShaderNodeOutputMaterial'); em = g.node('ShaderNodeEmission')
    geo = g.node('ShaderNodeNewGeometry'); tc = g.node('ShaderNodeTexCoord')
    P = tc.outputs['Object']; N = geo.outputs['Normal']; V = geo.outputs['Incoming']
    day = g.node('ShaderNodeTexEnvironment', image=bpy.data.images.load(os.path.join(TEXD, 'day_full.jpg')))
    night = g.node('ShaderNodeTexEnvironment', image=bpy.data.images.load(os.path.join(TEXD, 'night_hi.jpg' if os.path.exists(os.path.join(TEXD, 'night_hi.jpg')) else 'night.jpg')))
    nt.links.new(P, day.inputs[0]); nt.links.new(P, night.inputs[0])
    ndl = g.vmath('DOT_PRODUCT', N, tuple(SUN_DIR)); ndv = g.math('MAXIMUM', g.vmath('DOT_PRODUCT', N, V), 0.0)
    # --- procedural cloud deck: large weather systems broken up by finer detail
    n1 = g.node('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 13.0; n1.inputs['Detail'].default_value = 12
    n1.inputs['Roughness'].default_value = 0.62; n1.inputs['Distortion'].default_value = 1.6
    mp = g.node('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 1.0, 1.9); nt.links.new(P, mp.inputs[0])
    nt.links.new(mp.outputs[0], n1.inputs['Vector'])
    n2 = g.node('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 85.0; n2.inputs['Detail'].default_value = 8
    n2.inputs['Roughness'].default_value = 0.7; n2.inputs['Distortion'].default_value = 0.8
    nt.links.new(P, n2.inputs['Vector'])
    n3 = g.node('ShaderNodeTexNoise'); n3.inputs['Scale'].default_value = 3.2; n3.inputs['Detail'].default_value = 3
    n3.inputs['Distortion'].default_value = 2.5; nt.links.new(P, n3.inputs['Vector'])           # where the weather is
    front = g.smooth(n3.outputs['Fac'], 0.38, 0.62, -0.12, 0.1)
    cl = g.smooth(g.math('ADD', g.math('ADD', n1.outputs['Fac'], g.math('MULTIPLY', n2.outputs['Fac'], 0.35)), front), 0.6, 0.84)
    cells = g.node('ShaderNodeTexVoronoi', feature='SMOOTH_F1'); cells.inputs['Scale'].default_value = 190.0; nt.links.new(P, cells.inputs['Vector'])
    puffs = g.smooth(cells.outputs['Distance'], 0.5, 0.18)
    cl = g.math('MULTIPLY', cl, g.math('MULTIPLY_ADD', puffs, 0.45, 0.55), clamp=True)               # break the decks into cells
    thick = g.math('MULTIPLY_ADD', n2.outputs['Fac'], 0.5, 0.62)
    # --- surface
    sep = g.node('ShaderNodeSeparateColor'); nt.links.new(day.outputs['Color'], sep.inputs[0])
    ocean = g.smooth(g.math('SUBTRACT', sep.outputs[2], sep.outputs[0]), 0.0, 0.06)
    albedo = g.mix(cl, day.outputs['Color'], g.scale((0.92, 0.93, 0.95), thick))
    lambert = g.math('MAXIMUM', ndl, 0.0)
    warm = g.mix(g.smooth(ndl, 0.0, 0.11), (1.0, 0.8, 0.62, 1), (1.0, 0.985, 0.96, 1))        # low sun reddens through the air
    surf = g.mix(1.0, g.scale(albedo, g.math('MULTIPLY', lambert, E_SUN / math.pi * 1.25)), warm, 'MULTIPLY')
    # sun glint on water
    refl = g.vmath('SUBTRACT', g.scale(N, g.math('MULTIPLY', ndl, 2.0)), tuple(SUN_DIR))
    rv = g.math('MAXIMUM', g.vmath('DOT_PRODUCT', refl, V), 0.0)
    glint = g.math('MULTIPLY', g.math('MULTIPLY', g.math('POWER', rv, 36.0), ocean), g.math('SUBTRACT', 1.0, cl))
    surf = g.mix(1.0, surf, g.scale(warm, g.math('MULTIPLY', glint, 2.2)), 'ADD')
    # air between us and the ground: blue in-scatter, strongest towards the limb where the path is longest
    rim = g.math('POWER', g.math('SUBTRACT', 1.0, ndv), 5.0)
    air = g.math('MULTIPLY', g.math('MULTIPLY_ADD', rim, 2.2, 0.5), g.smooth(ndl, -0.12, 0.22))
    surf = g.mix(1.0, surf, g.scale((0.07, 0.3, 1.0), air), 'ADD')
    # city lights on the night side
    nmask = g.math('MULTIPLY', g.smooth(ndl, 0.02, -0.16), g.math('MULTIPLY_ADD', cl, -0.85, 1.0))
    nsep = g.node('ShaderNodeSeparateColor'); nt.links.new(night.outputs['Color'], nsep.inputs[0])
    nlum = g.math('MAXIMUM', g.math('MAXIMUM', nsep.outputs[0], nsep.outputs[1]), nsep.outputs[2])
    glow = g.math('POWER', g.smooth(nlum, 0.16, 1.0), 2.2)                       # only actual lights, not the map's grey land
    lights = g.scale((1.0, 0.55, 0.2), g.math('MULTIPLY', g.math('MULTIPLY', glow, nmask), NIGHT_GAIN))
    moonlit = g.mix(1.0, g.scale(albedo, g.math('MULTIPLY', g.smooth(ndl, 0.05, -0.1), 0.03)), (0.55, 0.72, 1.0, 1), 'MULTIPLY')  # night side: dark, not black
    # city glow scattering in thin cloud above the towns
    haze = g.scale((1.0, 0.55, 0.22), g.math('MULTIPLY', g.math('MULTIPLY', g.smooth(nlum, 0.05, 0.6), cl), g.math('MULTIPLY', g.smooth(ndl, 0.02, -0.16), 0.12)))
    moonlit = g.mix(1.0, moonlit, haze, 'ADD')
    lights = g.mix(1.0, lights, moonlit, 'ADD')
    total = g.mix(1.0, surf, lights, 'ADD')
    nt.links.new(total, em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m

def air_material():
    """Thin shell above the surface: the glowing blue line of atmosphere along the horizon."""
    m = bpy.data.materials.new('air'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); g = NT(nt)
    out = g.node('ShaderNodeOutputMaterial'); em = g.node('ShaderNodeEmission'); tr = g.node('ShaderNodeBsdfTransparent')
    add = g.node('ShaderNodeAddShader'); geo = g.node('ShaderNodeNewGeometry')
    N = geo.outputs['Normal']; V = geo.outputs['Incoming']
    ndl = g.vmath('DOT_PRODUCT', N, tuple(SUN_DIR)); ndv = g.math('ABSOLUTE', g.vmath('DOT_PRODUCT', N, V))
    limb = math.sqrt(1 - (1 / AIR_SCALE) ** 2)                 # ndv of the shell where the line of sight grazes the ground
    dens = g.math('MULTIPLY', g.smooth(ndv, 0.0, limb), g.math('POWER', g.math('SUBTRACT', 1.0, ndv), 5.0))
    dens = g.math('MULTIPLY', dens, g.smooth(ndv, limb * 2.6, limb * 1.05, 0.12, 1.0))   # mostly the line above the horizon, little haze over the disc
    low = g.smooth(ndv, limb * 0.55, limb)                                         # 1 near the ground, 0 at the top of the air
    warmth = g.math('MULTIPLY', low, g.smooth(ndl, 0.3, -0.05))                    # red only where the sun is low
    col = g.mix(warmth, (0.16, 0.42, 1.0, 1), (1.0, 0.36, 0.08, 1))
    lit = g.smooth(ndl, -0.3, 0.25)
    mu = g.math('MAXIMUM', g.vmath('DOT_PRODUCT', g.scale(V, -1.0), tuple(SUN_DIR)), 0.0)
    mie = g.math('ADD', g.math('MULTIPLY_ADD', g.math('POWER', mu, 400.0), 3.5, 1.0), g.math('MULTIPLY', g.math('POWER', mu, 40.0), 0.9))
    lit = g.math('MULTIPLY', lit, mie)
    nt.links.new(col, em.inputs['Color']); nt.links.new(g.math('MULTIPLY', g.math('MULTIPLY', dens, lit), 2.2), em.inputs['Strength'])
    nt.links.new(tr.outputs[0], add.inputs[0]); nt.links.new(em.outputs[0], add.inputs[1]); nt.links.new(add.outputs[0], out.inputs['Surface'])
    return m

AIR_SCALE = 1.007
def geo_dir(lat, lon):
    la, lo = math.radians(lat), math.radians(-lon)
    return Vector((math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)))

def shell_material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); g = NT(nt)
    out = g.node('ShaderNodeOutputMaterial'); em = g.node('ShaderNodeEmission'); tr = g.node('ShaderNodeBsdfTransparent'); add = g.node('ShaderNodeAddShader')
    nt.links.new(tr.outputs[0], add.inputs[0]); nt.links.new(em.outputs[0], add.inputs[1]); nt.links.new(add.outputs[0], out.inputs['Surface'])
    return m, nt, g, em

def aurora_material(color, gain, radius=0.5, width=0.04, seed=0.0):   # a strong storm: the oval has pushed south over Europe
    """Auroral oval around the geomagnetic pole: a sharp lower border, rays, and gaps. Night side only."""
    m, nt, g, em = shell_material('aurora')
    geo = g.node('ShaderNodeNewGeometry'); tc = g.node('ShaderNodeTexCoord'); P = tc.outputs['Object']
    c = g.math('ARCCOSINE', g.vmath('DOT_PRODUCT', g.vmath('NORMALIZE', P), tuple(geo_dir(80.7, -72.7))))
    def noise(scale, detail, dist=0.0):
        n = g.node('ShaderNodeTexNoise', noise_dimensions='4D'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
        n.inputs['Distortion'].default_value = dist; n.inputs['W'].default_value = seed; nt.links.new(P, n.inputs['Vector']); return n.outputs['Fac']
    c = g.math('ADD', c, g.math('MULTIPLY_ADD', noise(5.0, 4), 0.11, -0.055))             # the oval wanders
    band = g.math('MULTIPLY', g.smooth(c, radius + width, radius), g.smooth(c, radius - width * 2.2, radius - width * 0.2))
    rays = g.smooth(noise(90.0, 2, 0.6), 0.35, 0.72)
    gaps = g.smooth(noise(11.0, 3), 0.34, 0.6)
    night = g.smooth(g.vmath('DOT_PRODUCT', geo.outputs['Normal'], tuple(SUN_DIR)), 0.14, -0.08)
    k = g.math('MULTIPLY', g.math('MULTIPLY', band, g.math('MULTIPLY_ADD', rays, 1.0, 0.3)), g.math('MULTIPLY', gaps, night))
    em.inputs['Color'].default_value = (*color, 1); nt.links.new(g.math('MULTIPLY', k, gain), em.inputs['Strength'])
    return m

def airglow_material(scale):
    """The thin green line of airglow that astronauts photograph above the limb at night."""
    m, nt, g, em = shell_material('airglow')
    geo = g.node('ShaderNodeNewGeometry')
    ndv = g.math('ABSOLUTE', g.vmath('DOT_PRODUCT', geo.outputs['Normal'], geo.outputs['Incoming']))
    limb = math.sqrt(1 - (1 / scale) ** 2)
    k = g.math('MULTIPLY', g.smooth(ndv, limb * 0.25, limb * 0.6), g.smooth(ndv, limb * 1.0, limb * 0.75))     # only edge-on, above the air
    em.inputs['Color'].default_value = (0.3, 1.0, 0.42, 1); nt.links.new(g.math('MULTIPLY', k, 0.03), em.inputs['Strength'])
    return m

MOON_DIR = view_dir(math.radians(-5.2), math.radians(12.6))
def moon_material():
    """A young crescent Moon beside the rising sun: sunlit sliver plus earthshine on the dark side."""
    m = bpy.data.materials.new('moon'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); g = NT(nt)
    out = g.node('ShaderNodeOutputMaterial'); em = g.node('ShaderNodeEmission'); geo = g.node('ShaderNodeNewGeometry'); tc = g.node('ShaderNodeTexCoord')
    n = g.node('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 2.2; n.inputs['Detail'].default_value = 9; n.inputs['Distortion'].default_value = 0.6
    v = g.node('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 16.0
    nt.links.new(tc.outputs['Object'], n.inputs['Vector']); nt.links.new(tc.outputs['Object'], v.inputs['Vector'])
    alb = g.mix(g.smooth(n.outputs['Fac'], 0.42, 0.62), (0.07, 0.07, 0.08, 1), (0.2, 0.19, 0.18, 1))             # maria and highlands
    alb = g.scale(alb, g.smooth(v.outputs['Distance'], 0.0, 0.35, 0.72, 1.08))                                   # crater floors
    # The Moon sits only ~8 degrees from the sun here, so its true crescent would be a hairline. The light direction is
    # swung a little towards the viewer to give a readable crescent that still faces the sun.
    perp = (SUN_DIR - SUN_DIR.dot(MOON_DIR) * MOON_DIR).normalized()
    L = (MOON_DIR * 0.8 + perp * 0.6).normalized()
    ndl = g.math('MAXIMUM', g.vmath('DOT_PRODUCT', geo.outputs['Normal'], tuple(L)), 0.0)
    lit = g.scale(alb, g.math('MULTIPLY', g.math('POWER', ndl, 0.7), E_SUN / math.pi * 3.0))
    shine = g.mix(1.0, g.scale(alb, 0.16), (0.6, 0.76, 1.0, 1), 'MULTIPLY')
    nt.links.new(g.mix(1.0, lit, shine, 'ADD'), em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m
def earth_orientation(lat, lon, spin):
    """Rotation that puts (lat, lon) of the equirectangular maps where the hero camera looks at the planet."""
    from mathutils import Quaternion
    aim = (math.cos(math.radians(6)) * _d0 + math.sin(math.radians(6)) * _o).normalized()   # a little inside the limb
    oc = CAM_POS - EARTH_C; b = oc.dot(aim); t = -b - math.sqrt(b * b - (oc.length_squared - EARTH_R ** 2))
    global EARTH_U
    u = (CAM_POS + aim * t - EARTH_C).normalized(); EARTH_U = u.copy()
    la, lo = math.radians(lat), math.radians(-lon)
    q = Vector((math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)))
    R0 = q.rotation_difference(u)
    # sunrise comes from the east: turn the globe about the view point so local east faces the sun
    east = R0 @ Vector((math.sin(lo), -math.cos(lo), 0.0))
    to_sun = (SUN_DIR - SUN_DIR.dot(u) * u).normalized()
    ang = math.atan2(east.cross(to_sun).dot(u), east.dot(to_sun))
    return Quaternion(u, ang + math.radians(spin)) @ R0
import sys as _sys
if 'EARTH' in os.environ:   # quick look-dev override: EARTH="lat,lon,spin"
    _e = [float(x) for x in os.environ['EARTH'].split(',')]; EARTH_FOCUS = (_e[0], _e[1]); EARTH_SPIN = _e[2]
EARTH_Q = earth_orientation(*EARTH_FOCUS, EARTH_SPIN)
SHELLS = (('earth', 1.0, earth_material), ('air', AIR_SCALE, air_material), ('airglow', 1.0148, lambda: airglow_material(1.0148)),
          ('aurora_g', 1.017, lambda: aurora_material((0.16, 1.0, 0.42), 1.1)),
          ('aurora_g2', 1.024, lambda: aurora_material((0.2, 1.0, 0.5), 0.55, width=0.03)),
          ('aurora_r', 1.036, lambda: aurora_material((0.85, 0.1, 0.32), 0.16, width=0.03)))
for nm, sc, mfun in SHELLS:
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=256, v_segments=128, radius=1.0)
    for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new(nm); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(nm, me); OUT.objects.link(ob)
    ob.location = EARTH_C; ob.scale = (EARTH_R * sc,) * 3
    ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = EARTH_Q
    me.materials.append(mfun())
    ob.visible_shadow = False

bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=1.0)
for f in bm.faces: f.smooth = True
me = bpy.data.meshes.new('moon'); bm.to_mesh(me); bm.free()
moon = bpy.data.objects.new('moon', me); OUT.objects.link(moon)
moon.location = CAM_POS + MOON_DIR * 3000.0; moon.scale = (3000.0 * math.tan(math.radians(1.0)),) * 3; moon.rotation_euler = (0.4, 0.2, 1.0)
me.materials.append(moon_material()); moon.visible_shadow = False

# world: stars + faint nebula
w = bpy.data.worlds.new('Space'); scene.world = w; w.use_nodes = True
nt = w.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground')
tc = nt.nodes.new('ShaderNodeTexCoord')
vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 260
nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
st = nt.nodes.new('ShaderNodeMapRange'); st.inputs['From Min'].default_value = 0.07; st.inputs['From Max'].default_value = 0.0
st.inputs['To Min'].default_value = 0.0; st.inputs['To Max'].default_value = 1.0
nt.links.new(vor.outputs['Distance'], st.inputs['Value'])
pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 3.0; nt.links.new(st.outputs[0], pw.inputs[0])
sepc = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(vor.outputs['Color'], sepc.inputs[0])
rb = nt.nodes.new('ShaderNodeMath'); rb.operation = 'POWER'; rb.inputs[1].default_value = 7.0; nt.links.new(sepc.outputs[1], rb.inputs[0])
pw2 = nt.nodes.new('ShaderNodeMath'); pw2.operation = 'MULTIPLY'; nt.links.new(pw.outputs[0], pw2.inputs[0]); nt.links.new(rb.outputs[0], pw2.inputs[1])
sc = nt.nodes.new('ShaderNodeMix'); sc.data_type = 'RGBA'; sc.blend_type = 'MULTIPLY'; MIXIN(sc, 'Factor').default_value = 1.0
tint = nt.nodes.new('ShaderNodeMix'); tint.data_type = 'RGBA'
MIXIN(tint, 'A').default_value = (1.0, 0.75, 0.55, 1); MIXIN(tint, 'B').default_value = (0.6, 0.8, 1.0, 1)
nt.links.new(vor.outputs['Color'], MIXIN(tint, 'Factor'))
bright = nt.nodes.new('ShaderNodeVectorMath'); bright.operation = 'SCALE'; bright.inputs['Scale'].default_value = 3.0
nt.links.new(MIXOUT(tint), bright.inputs[0])
nt.links.new(bright.outputs[0], MIXIN(sc, 'A')); nt.links.new(pw2.outputs[0], MIXIN(sc, 'B'))
neb = nt.nodes.new('ShaderNodeTexNoise'); neb.inputs['Scale'].default_value = 2.4; neb.inputs['Detail'].default_value = 7; neb.inputs['Roughness'].default_value = 0.62
nt.links.new(tc.outputs['Generated'], neb.inputs['Vector'])
nr = nt.nodes.new('ShaderNodeValToRGB')
nr.color_ramp.elements[0].position = 0.42; nr.color_ramp.elements[0].color = (0, 0, 0, 1)
nr.color_ramp.elements[1].position = 0.85; nr.color_ramp.elements[1].color = (0.012, 0.028, 0.075, 1)
e = nr.color_ramp.elements.new(0.62); e.color = (0.008, 0.004, 0.018, 1)
nt.links.new(neb.outputs['Fac'], nr.inputs[0])
addn = nt.nodes.new('ShaderNodeMix'); addn.data_type = 'RGBA'; addn.blend_type = 'ADD'; MIXIN(addn, 'Factor').default_value = 1.0
nt.links.new(MIXOUT(sc), MIXIN(addn, 'A')); nt.links.new(nr.outputs['Color'], MIXIN(addn, 'B'))
nt.links.new(MIXOUT(addn), bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
nt.links.new(bg.outputs[0], out.inputs['Surface'])

# ================================================================= LIGHTS / CAMERA
sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 9.0; sun.color = (1.0, 0.77, 0.54); sun.angle = math.radians(0.9)
so = bpy.data.objects.new('Sun', sun); COL.objects.link(so)
so.rotation_euler = SUN_DIR.to_track_quat('Z', 'Y').to_euler()

hl = bpy.data.lights.new('HoloGlow', 'POINT'); hl.energy = 26; hl.color = (0.16, 0.72, 1.0); hl.shadow_soft_size = 0.7
ho = bpy.data.objects.new('HoloGlow', hl); COL.objects.link(ho); ho.visible_glossy = False; ho.location = DAIS + Vector((0, 0, HOLO_Z))

cam = bpy.data.cameras.new('Hero'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(50); cam.clip_start = 0.1; cam.clip_end = 5000
co = bpy.data.objects.new('Hero', cam); scene.collection.objects.link(co)
co.location = CAM_POS
co.rotation_euler = (CAM_TGT - CAM_POS).to_track_quat('-Z', 'Y').to_euler()
scene.camera = co

e = bpy.data.objects.new('FX_holo', None); FXC.objects.link(e); e.location = DAIS + Vector((0, 0, HOLO_Z)); e['fx'] = 'holo'

# ================================================================= RENDER SETTINGS
scene.render.engine = 'CYCLES'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.0
scene['lobby'] = dict(cam=list(CAM_POS), tgt=list(CAM_TGT), fov=50.0, dais=list(DAIS), portal=list(PORTAL_C), portal_r=PORTAL_R,
                      sun=list(SUN_DIR), floor=dict(ior=FLOOR_IOR, rough=list(FLOOR_ROUGH), tile=FX / 4.0, noise=0.55), holo=list(DAIS + Vector((0, 0, HOLO_Z))), floor_half=FX, y0=Y0, y1=Y1,
                      chand=dict(pivot=[DAIS.x, DAIS.y], center=list(CH_C)), doors=DOORS, room='lobby',
                      screens=[f'FX_screen_{side_grp(s)}{bi}' for s in (1, -1) for bi, k in enumerate(PROGRAM[s]) if k == 'screen'],   # in content.json order
                      earth=dict(c=list(EARTH_C), r=EARTH_R, u=list(EARTH_U)),
                      # The ring turns once in `period` seconds about `axis` (the hall's long axis), so everything outside
                      # turns in the window. bake.py bakes the light from outside at several angles; the sun's direct
                      # light is drawn live (sun_e: its irradiance, W/m2 per channel).
                      spin=dict(axis=[0.0, 1.0, 0.0], period=120.0, sun_e=[sun.energy * c for c in sun.color]), backdrop_fov=100.0,
                      em={k: dict(color=list(c), strength=s) for k, (c, s) in EM.items()})

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'lobby.blend'))
print('OBJECTS', len(bpy.data.objects), 'TRIS', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
