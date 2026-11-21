"""Fabrication exhibit assets, using the shared kit and the room's material palette.

Coordinates are in metres. M places the plinth at floor level and the plinth
exhibits at plinth-top level. The bay assemblies document their own datums.
Indexed builders take i as the suffix for their part names.
"""

def a_rover(M=I4):
    g = 'props'
    def part(name, size, xyz, mat_, bevel=0):
        return rbox('rv_' + name, size, M @ T(xyz), mat_, g, bevel=bevel)
    def link(name, a, b, radius, material):
        return rod('rv_' + name, a, b, radius, material, g, M=M)
    part('undertray', (1.27, .73, .16), (0, 0, .52), 'steel', .035)
    part('avionics', (1.42, .82, .21), (0, 0, .665), 'white', .035)
    part('deck_frame', (1.48, .88, .035), (0, 0, .78), 'steel', .012)
    for col in range(6):
        for row in range(4):
            part('pv_cell', (.222, .194, .009), ((col-2.5)*.235, (row-1.5)*.206, .802), 'solar', .003)
    for side in (-1, 1):
        y = side*.515
        # Main rocker carries the forward axle and a pivoting bogie for the rear pair.
        pivot = (.07, y, .60); bogie = (-.32, y, .415)
        link('cross_shaft', (.07, side*.36, .60), pivot, .052, 'steel')
        for a, b in ((pivot, (.62,y,.24)), (pivot,bogie), (bogie,(-.62,y,.24)), (bogie,(0,y,.24))):
            link('rocker', a, b, .034, 't_light')
        for x in (-.62, 0, .62):
            link('axle', (x, y, .24), (x, side*.646, .24), .039, 'steel')
            W = M @ T((x, side*.65, .24), (-side*pi/2,0,0))
            lathe('rv_tyre', [(.117,-.088),(.202,-.088),(.232,-.068),(.232,.068),(.202,.088),(.117,.088)], 'rubber', g, segs=32, M=W)
            lathe('rv_rim', [(0,-.075),(.13,-.075),(.13,.089),(.113,.09),(.10,.063),(.055,.063),(.047,.098),(0,.098)], 'steel', g, segs=24, M=W)
            for k in range(18):
                A = W @ Matrix.Rotation(k*2*pi/18, 4, 'Z')
                rbox('rv_cleat', (.012,.017,.15), A @ T((.233,0,0),(.24*side,0,0)), 't_steel', g)
            for k in range(5):
                A = W @ Matrix.Rotation(k*2*pi/5, 4, 'Z')
                lathe('rv_lug', [(0,.071),(.012,.071),(.012,.063),(0,.063)], 'chrome', g, segs=6, M=A @ T((.077,0,0)))
    # Bearing, mast, pan head and recessed binocular optics (glass, not headlights).
    B = M @ T((.49,0,.803))
    lathe('rv_mast', [(0,0),(.095,0),(.095,.055),(.044,.073),(.031,.59),(.073,.6),(.073,.65),(0,.65)], 'steel', g, segs=20, M=B)
    part('sensor_head', (.18,.37,.14), (.49,0,1.507), 't_light', .021)
    for y in (-.108,.108):
        L = M @ T((.58,y,1.507),(0,pi/2,0))
        lathe('rv_lens_hood', [(.032,0),(.052,0),(.052,.058),(.043,.074),(.034,.074)], 't_black', g, segs=20, M=L)
        lathe('rv_objective', [(0,.048),(.034,.044),(.034,.038),(0,.038)], 't_glass', g, segs=20, M=L)
    link('dish_pedestal', (-.44,.1,.8), (-.44,.1,.986), .035, 'steel')
    D = M @ T((-.44,.1,.98),(.3,-.4,0))
    lathe('rv_dish', [(0,.006),(.12,.022),(.23,.076),(.23,.065),(.12,.012),(0,-.006)], 't_light', g, segs=32, M=D)
    for k in range(3):
        a=k*2*pi/3
        rod('rv_feed_strut', (.21*math.cos(a),.21*math.sin(a),.069),(0,0,.172),.005,'steel',g,M=D)
    lathe('rv_feed', [(0,.185),(.024,.185),(.016,.148),(0,.148)], 'brass',g,segs=12,M=D)


def a_manipulator(M=I4):
    g='props'
    lathe('ar_slew', [(0,0),(.35,0),(.35,.048),(.30,.059),(.265,.14),(.265,.19),(.23,.19),(.23,.21),(.254,.22),(.205,.39),(0,.39)],'steel',g,segs=40,M=M)
    for k in range(8):
        A=M @ Matrix.Rotation(k*pi/4,4,'Z') @ T((.318,0,.048))
        lathe('ar_anchor', [(0,.016),(.016,.016),(.016,0),(0,0)],'chrome',g,segs=6,M=A)
    J=[Vector(v) for v in ((0,0,.42),(.34,0,1.33),(1.11,0,1.68),(1.46,0,1.31))]
    for k,(a,b) in enumerate(zip(J,J[1:])):
        axis=b-a; B=M @ Matrix.Translation(a) @ axis.to_track_quat('Z','Y').to_matrix().to_4x4(); L=axis.length
        r=(.165,.138,.093)[k]
        # Cast link narrows between its bearing bosses; recessed service cover on its flank.
        lathe('ar_casting', [(0,.025),(r*.78,.025),(r,.15),(r*.83,.23),(r*.65,L-.18),(r*.77,L-.11),(r*.69,L-.025),(0,L-.025)], 'yellow',g,segs=12,M=B)
        rbox('ar_cover', (.055,.014,L*.43), B @ T((0,r*.73,L*.49)), 'steel',g,bevel=.006)
    for k,j in enumerate(J):
        r=(.174,.15,.111,.077)[k]; B=M @ T(j, (pi/2,0,0))
        lathe('ar_gearbox', [(0,-r),(.86*r,-r),(r,-.81*r),(r,.8*r),(.86*r,r),(.74*r,r),(.74*r,1.11*r),(0,1.11*r)], 't_steel',g,segs=24,M=B)
        for n in range(6):
            A=B @ Matrix.Rotation(n*pi/3,4,'Z') @ T((.61*r,0,1.11*r))
            lathe('ar_bolt', [(0,.008),(.011,.008),(.011,0),(0,0)],'chrome',g,segs=6,M=A)
    # Flexible loom follows the non-drive side; leave a service loop at the elbow.
    pts=[(0,.15,.42),(.09,.20,.70),(.26,.18,1.21),(.30,.20,1.40),(.40,.20,1.47),(.52,.16,1.45),(1.02,.13,1.64),(1.12,.14,1.70),(1.22,.12,1.62),(1.45,.08,1.33)]
    for a,b in zip(pts,pts[1:]): rod('ar_loom',a,b,.019,'t_rubber',g,M=M)
    x,_,z=J[-1]; rbox('ar_slide',(.13,.23,.08),M @ T((x,0,z-.10)),'t_steel',g,bevel=.012)
    for sign in (-1,1):
        rbox('ar_finger',(.076,.033,.122),M @ T((x,sign*.088,z-.20)),'t_light',g,bevel=.006)
        rbox('ar_pad',(.075,.019,.055),M @ T((x,sign*.067,z-.232)),'rubber',g)
    lathe('ar_sample', [(0,.17),(.095,.17),(.12,.13),(.12,.028),(.097,0),(0,0)],'copper',g,segs=24,M=M @ T((1.15,0,0)))


def a_plinth(M=I4, i=0):
    """Build the lit plinth and return its top centre in world coordinates."""
    lathe(f'plinth{i}', [(0, 0.42), (1.35, 0.42), (1.35, 0.34), (1.22, 0.34), (1.22, 0)], 'white', 'props', segs=64, closed=False, M=M)
    lathe(f'plinth_led{i}', [(1.24, 0.32), (1.33, 0.32), (1.33, 0.33), (1.24, 0.33)], em='step', segs=64, M=M)
    lathe(f'plinth_top{i}', [(0, 0.42), (1.2, 0.42), (1.2, 0.425), (0, 0.425)], 'dark', 'props', segs=48, closed=False, M=M)
    return M @ Vector((0, 0, 0.425))


def a_engine(M=I4, i=0):
    lathe(f'en_bell{i}', [(0.2, 1.05), (0.26, 0.9), (0.42, 0.6), (0.6, 0.3), (0.68, 0.12), (0.66, 0.12), (0.58, 0.3), (0.4, 0.6), (0.24, 0.9), (0.18, 1.05)], 'copper', 'props', segs=64, M=M)
    lathe(f'en_chamber{i}', [(0, 1.5), (0.2, 1.5), (0.28, 1.4), (0.28, 1.15), (0.2, 1.04), (0, 1.04)], 'chrome', 'props', segs=32, closed=False, M=M)
    for k in range(10):                                                       # stiffening hoops on the bell
        z = 0.2 + k * 0.08; r = 0.67 - (z - 0.12) * 0.52
        lathe(f'en_hoop{i}{k}', [(r, z), (r + 0.018, z), (r + 0.018, z + 0.02), (r, z + 0.02)], 'steel', 'props', segs=48, M=M)
    for a in (0.6, 2.7, 4.4):
        lathe(f'en_pump{i}', [(0, 0.34), (0.11, 0.34), (0.13, 0.3), (0.13, 0.04), (0.11, 0), (0, 0)], 'wall2', 'props', segs=20, closed=False, M=M @ T((0.36 * math.cos(a), 0.36 * math.sin(a), 1.22)))
        rbox(f'en_line{i}', (0.035, 0.035, 0.62), M @ T((0.5 * math.cos(a), 0.5 * math.sin(a), 0.95), (0.42 * math.sin(a), -0.42 * math.cos(a), 0)), 'brass', 'props')
    for a in range(3):                                                        # test stand
        ang = a * 2 * pi / 3 + 0.5
        rbox(f'en_leg{i}', (0.06, 0.06, 1.25), M @ T((0.78 * math.cos(ang), 0.78 * math.sin(ang), 0.6), (0.2 * math.sin(ang), -0.2 * math.cos(ang), 0)), 'yellow', 'props')
    lathe(f'en_ring{i}', [(0.64, 1.16), (0.72, 1.16), (0.72, 1.22), (0.64, 1.22)], 'yellow', 'props', segs=48, M=M)
    for a in range(3):
        ang = a * 2 * pi / 3 + 0.5
        rbox(f'en_arm{i}', (0.42, 0.05, 0.05), M @ Matrix.Rotation(ang, 4, 'Z') @ T((0.46, 0, 1.19)), 'yellow', 'props')


def a_lattice(M=I4, i=0):
    C = M @ T((0, 0, 1.25))
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.85)
    ob = finish(f'lt_shell{i}', bm, 'chrome', 'props', M=C @ Matrix.Rotation(0.4, 4, 'X'))
    w = ob.modifiers.new('wire', 'WIREFRAME'); w.thickness = 0.035; w.use_replace = True
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.42)
    ob = finish(f'lt_inner{i}', bm, 'brass', 'props', M=C @ Matrix.Rotation(0.9, 4, 'Y'))
    w = ob.modifiers.new('wire', 'WIREFRAME'); w.thickness = 0.03; w.use_replace = True
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.13)
    finish(f'lt_core{i}', bm, None, em='core', M=C)
    lathe(f'lt_post{i}', [(0, 0.4), (0.03, 0.4), (0.05, 0.02), (0.22, 0.01), (0.22, 0), (0, 0)], 'steel', 'props', segs=20, closed=False, M=M)
    glow(f'lt_glow{i}', C.translation, 60, color=(0.1, 0.8, 1.0), r=0.13)


def a_cargo_bulkhead(M=I4):
    """Static closed cargo bulkhead and two leaves; M is at floor level on the rear wall."""
    DW, DH = 5.2, 5.2
    box('doorframe_l', -DW - 0.5, -DW, -0.5, 0, 0, DH + 0.5, 'steel', 'center', bevel=0.03, M=M)
    box('doorframe_r', DW, DW + 0.5, -0.5, 0, 0, DH + 0.5, 'steel', 'center', bevel=0.03, M=M)
    box('doorframe_t', -DW - 0.5, DW + 0.5, -0.5, 0, DH, DH + 0.5, 'steel', 'center', bevel=0.03, M=M)
    for d in (-1, 1):
        box(f'door{d}', d * 0.06, d * DW, -0.3, -0.12, 0.02, DH, 'wall2', 'center', bevel=0.02, M=M)
        for i in range(4):
            z = 0.9 + i * 1.3
            box(f'doorrib{d}{i}', d * 0.2, d * (DW - 0.15), -0.36, -0.3, z, z + 0.14, 'steel', 'center', bevel=0.01, M=M)
        for i in range(13):
            x0 = 0.1 + i * 0.4
            prism(f'chev{d}{i}', [(d * x0, 0.04), (d * (x0 + 0.2), 0.04), (d * (x0 + 0.5), 0.62), (d * (x0 + 0.3), 0.62)], 'Y', -0.31, -0.3, 'hazard_y' if i % 2 == 0 else 'hazard_k', 'center', M=M)
        box(f'doorwin{d}', d * 1.5, d * 3.7, -0.31, -0.3, 3.0, 3.7, 'lum_cool', 'center', M=M)
    box('doorseam', -0.035, 0.035, -0.33, -0.3, 0.02, DH, em='seam', M=M)
    text3d('baysign', 'BAY 02', 0.75, M @ T((0, -0.52, DH + 0.95), (pi / 2, 0, 0)), spacing=1.25)
    text3d('baysign2', 'CARGO LIFT  ·  SPOKE  ·  HUB DOCK', 0.2, M @ T((0, -0.52, DH + 0.62), (pi / 2, 0, 0)), spacing=1.3)
    for d in (-1, 1):
        B = M @ T((d * (DW + 0.25), -0.56, DH + 0.5))
        lathe(f'beacon{d}', [(0, 0.2), (0.07, 0.19), (0.09, 0.0), (0, 0.0)], em='beacon', segs=16, closed=False, M=B)
        lathe(f'beaconbase{d}', [(0, 0.0), (0.12, 0.0), (0.12, -0.06), (0, -0.06)], 'dark', 'center', segs=16, closed=False, M=B)


def a_gantry(M=I4):
    """Static bridge, trolley and hoist; M is below the hook at floor level. Return the world sling anchor."""
    box('bridge', -6.6, 6.6, -0.3, 0.3, 6.36, 6.95, 'yellow', 'center', bevel=0.03, M=M)
    box('bridgeweb', -6.5, 6.5, -0.36, 0.36, 6.6, 6.68, 'steel', 'center', M=M)
    for d in (-1, 1):
        box(f'endtruck{d}', d * 6.2, d * 6.75, -0.9, 0.9, 6.36, 6.7, 'steel', 'center', bevel=0.03, M=M)
    box('trolley', -0.7, 0.7, -0.55, 0.55, 6.1, 6.4, 'steel', 'center', bevel=0.03, M=M)
    box('hoist', -0.35, 0.35, -0.3, 0.3, 5.7, 6.1, 'yellow', 'center', bevel=0.04, M=M)
    for dx in (-0.12, 0.12):
        box('cable', dx - 0.012, dx + 0.012, -0.012, 0.012, 4.75, 5.7, 'chrome', 'center', M=M)
    hook = M @ T((0, 0, 4.45))
    lathe('hookblock', [(0, 0.3), (0.2, 0.3), (0.24, 0.1), (0.14, 0.0), (0, 0.0)], 'yellow', 'center', segs=20, closed=False, M=hook)
    return hook.translation


def a_solar_wing(M=I4, *, d=1):
    """One deployed wing with static drive and hinges; M is the bus frame, d selects the ±X side."""
    rbox(f'sat_yoke{d}', (0.5, 0.06, 0.06), M @ T((d * 0.98, 0, 0)), 'chrome', 'center')
    # Keep the frame and pins on +Y on both wings, rather than reflecting the mesh.
    W = M @ T((d*.91,0,0),(0,d*pi/2,0))
    lathe('array_drive',[(0,0),(.15,0),(.15,.13),(.115,.15),(.115,.21),(0,.21)],'steel','center',segs=24,M=W)
    for joint in range(2):
        seam=d*(2.26+joint*1.08)
        for z in (-.55,.55):
            rbox('array_hinge_leaf',(.16,.042,.13),M @ T((seam,.029,z)),'steel','center',bevel=.007)
            rod('array_hinge_pin',(seam,.058,z-.086),(seam,.058,z+.086),.019,'chrome','center',M=M)
    for i in range(3):
        cx = d * (1.2 + 0.52 + i * 1.08)
        rbox(f'sat_wing{d}{i}', (1.0, 0.03, 1.5), M @ T((cx, 0, 0), (0.0, 0, 0)), 'solar', 'center')
        rbox(f'sat_wingf{d}{i}', (1.04, 0.02, 1.54), M @ T((cx, 0.012, 0)), 'chrome', 'center')
        for j in range(1, 6):
            rbox(f'sat_cell{d}{i}{j}', (1.0, 0.032, 0.008), M @ T((cx, 0, -0.75 + j * 0.25)), 'chrome', 'center')
        for j in range(1, 4):
            rbox(f'sat_cellv{d}{i}{j}', (0.008, 0.032, 1.5), M @ T((cx - 0.5 + j * 0.25, 0, 0)), 'chrome', 'center')


def a_satellite(M=I4):
    """Static payload with both deployed wings; M is at the bus centre, without rigging."""
    def ngon(name, n, r, h, M, m, grp):
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=r, radius2=r, depth=h)
        return finish(name, bm, m, grp, M=M @ Matrix.Rotation(pi / n, 4, 'Z'))

    ngon('sat_bus', 8, 0.8, 1.7, M, 'foil', 'center')
    for z in (0.89, -0.89):
        ngon('sat_deck', 8, 0.84, 0.08, M @ T((0, 0, z)), 'dark', 'center')
    lathe('sat_adapter', [(0.45, 0.93), (0.52, 0.93), (0.52, 1.05), (0.45, 1.05)], 'chrome', 'center', segs=32, M=M)
    FR = 0.8 * math.cos(pi / 8)  # distance from the axis to a face
    for a, kind in ((90, 'box'), (270, 'radiator'), (45, 'horn'), (135, 'box2'), (225, 'tracker'), (315, 'box')):
        Mf = M @ Matrix.Rotation(math.radians(a), 4, 'Z')
        if kind == 'box': rbox('sat_eq', (0.1, 0.42, 0.6), Mf @ T((FR + 0.05, 0, 0.1)), 'white', 'center', bevel=0.015)
        elif kind == 'box2':
            rbox('sat_eq', (0.14, 0.36, 0.36), Mf @ T((FR + 0.07, 0, 0.4)), 'dark', 'center', bevel=0.015)
            rbox('sat_eq', (0.08, 0.3, 0.5), Mf @ T((FR + 0.04, 0, -0.3)), 'white', 'center', bevel=0.01)
        elif kind == 'radiator':
            rbox('sat_rad', (0.03, 0.56, 1.3), Mf @ T((FR + 0.02, 0, 0)), 'white', 'center')
            for j in range(6): rbox('sat_radfin', (0.05, 0.5, 0.02), Mf @ T((FR + 0.045, 0, -0.5 + j * 0.2)), 'chrome', 'center')
        elif kind == 'horn': lathe('sat_horn', [(0, 0), (0.05, 0), (0.16, 0.3), (0.15, 0.3), (0.04, 0.02), (0, 0.02)], 'chrome', 'center', segs=20, closed=False, M=Mf @ T((FR, 0, 0.3), (0, pi / 2, 0)))
        else:
            for dz in (-0.2, 0.25): lathe('sat_tracker', [(0, 0), (0.07, 0), (0.1, 0.22), (0.09, 0.22), (0.06, 0.02), (0, 0.02)], 'dark', 'center', segs=16, closed=False, M=Mf @ T((FR, 0, dz), (0, pi / 2 - 0.5, 0)))
    for a in (45, 135, 225, 315):  # thruster quads on the lower deck
        Mq = M @ Matrix.Rotation(math.radians(a), 4, 'Z') @ T((0.86, 0, -0.8))
        rbox('sat_quad', (0.12, 0.12, 0.12), Mq, 'dark', 'center', bevel=0.01)
        for rx, ry in ((pi / 2, 0), (-pi / 2, 0), (0, pi / 2)):
            lathe('sat_thr', [(0, 0), (0.02, 0), (0.045, 0.1), (0.04, 0.1), (0.015, 0.01), (0, 0.01)], 'chrome', 'center', segs=10, closed=False, M=Mq @ T((0, 0, 0), (rx, ry, 0)) @ T((0, 0, 0.06)))
    rbox('sat_mast', (0.03, 0.03, 0.9), M @ T((0.3, 0.3, 1.4)), 'chrome', 'center')
    lathe('sat_omni', [(0, 0), (0.06, 0.02), (0.06, 0.1), (0, 0.14)], 'white', 'center', segs=12, closed=False, M=M @ T((0.3, 0.3, 1.85)))
    lathe('sat_dish', [(0, 0.0), (0.25, 0.03), (0.5, 0.12), (0.72, 0.28), (0.74, 0.28), (0.5, 0.1), (0.25, 0.01), (0, -0.02)], 'white', 'center', segs=48, closed=False, M=M @ T((0, 0, -1.28), (pi, 0, 0)))
    # Rear dish is carried on a trussed spacer between the bus and reflector.
    for leg in range(3):
        a = leg*2*pi/3
        rod('dish_stay',(.36*math.cos(a),.36*math.sin(a),-.925),(.15*math.cos(a),.15*math.sin(a),-1.29),.018,'steel','center',M=M)
    lathe('sat_feed', [(0, 0.0), (0.03, 0.0), (0.03, 0.5), (0.07, 0.56), (0, 0.6)], 'chrome', 'center', segs=12, closed=False, M=M @ T((0, 0, -1.3), (pi, 0, 0)))
    lathe('sat_nozzle', [(0, 0.0), (0.1, 0.0), (0.2, 0.3), (0.19, 0.3), (0.09, 0.02), (0, 0.02)], 'chrome', 'center', segs=24, closed=False, M=M @ T((0, 0, 0.9)))
    for d in (-1, 1):
        a_solar_wing(M, d=d)


EXHIBIT_ASSETS = dict(rover=a_rover, arm=a_manipulator, engine=a_engine, lattice=a_lattice, plinth=a_plinth,
                      gantry=a_gantry, satellite=a_satellite, solar_wing=a_solar_wing, cargo_bulkhead=a_cargo_bulkhead)
