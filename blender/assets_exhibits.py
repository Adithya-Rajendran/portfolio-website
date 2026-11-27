# Fabrication Bay exhibit builders that use the shared kit and the room's material palette
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
        lathe('ar_casting', [(0,.025),(r*.78,.025),(r,.15),(r*.83,.23),(r*.65,L-.18),(r*.77,L-.11),(r*.69,L-.025),(0,L-.025)], 'yellow',g,segs=12,M=B)
        rbox('ar_cover', (.055,.014,L*.43), B @ T((0,r*.73,L*.49)), 'steel',g,bevel=.006)
    for k,j in enumerate(J):
        r=(.174,.15,.111,.077)[k]; B=M @ T(j, (pi/2,0,0))
        lathe('ar_gearbox', [(0,-r),(.86*r,-r),(r,-.81*r),(r,.8*r),(.86*r,r),(.74*r,r),(.74*r,1.11*r),(0,1.11*r)], 't_steel',g,segs=24,M=B)
        for n in range(6):
            A=B @ Matrix.Rotation(n*pi/3,4,'Z') @ T((.61*r,0,1.11*r))
            lathe('ar_bolt', [(0,.008),(.011,.008),(.011,0),(0,0)],'chrome',g,segs=6,M=A)
    pts=[(0,.15,.42),(.09,.20,.70),(.26,.18,1.21),(.30,.20,1.40),(.40,.20,1.47),(.52,.16,1.45),(1.02,.13,1.64),(1.12,.14,1.70),(1.22,.12,1.62),(1.45,.08,1.33)]
    for a,b in zip(pts,pts[1:]): rod('ar_loom',a,b,.019,'t_rubber',g,M=M)
    x,_,z=J[-1]; rbox('ar_slide',(.13,.23,.08),M @ T((x,0,z-.10)),'t_steel',g,bevel=.012)
    for sign in (-1,1):
        rbox('ar_finger',(.076,.033,.122),M @ T((x,sign*.088,z-.20)),'t_light',g,bevel=.006)
        rbox('ar_pad',(.075,.019,.055),M @ T((x,sign*.067,z-.232)),'rubber',g)
    lathe('ar_sample', [(0,.17),(.095,.17),(.12,.13),(.12,.028),(.097,0),(0,0)],'copper',g,segs=24,M=M @ T((1.15,0,0)))


def a_plinth(M=I4, i=0):
    lathe(f'plinth{i}', [(0, 0.42), (1.35, 0.42), (1.35, 0.34), (1.22, 0.34), (1.22, 0)], 'white', 'props', segs=64, closed=False, M=M)
    lathe(f'plinth_led{i}', [(1.24, 0.32), (1.33, 0.32), (1.33, 0.33), (1.24, 0.33)], em='step', segs=64, M=M)
    lathe(f'plinth_top{i}', [(0, 0.42), (1.2, 0.42), (1.2, 0.425), (0, 0.425)], 'dark', 'props', segs=48, closed=False, M=M)
    return M @ Vector((0, 0, 0.425))


def a_engine(M=I4, i=0):
    lathe(f'en_bell{i}', [(0.2, 1.05), (0.26, 0.9), (0.42, 0.6), (0.6, 0.3), (0.68, 0.12), (0.66, 0.12), (0.58, 0.3), (0.4, 0.6), (0.24, 0.9), (0.18, 1.05)], 'copper', 'props', segs=64, M=M)
    lathe(f'en_chamber{i}', [(0, 1.5), (0.2, 1.5), (0.28, 1.4), (0.28, 1.15), (0.2, 1.04), (0, 1.04)], 'chrome', 'props', segs=32, closed=False, M=M)
    for k in range(10):
        z = 0.2 + k * 0.08; r = 0.67 - (z - 0.12) * 0.52
        lathe(f'en_hoop{i}{k}', [(r, z), (r + 0.018, z), (r + 0.018, z + 0.02), (r, z + 0.02)], 'steel', 'props', segs=48, M=M)
    for a in (0.6, 2.7, 4.4):
        lathe(f'en_pump{i}', [(0, 0.34), (0.11, 0.34), (0.13, 0.3), (0.13, 0.04), (0.11, 0), (0, 0)], 'wall2', 'props', segs=20, closed=False, M=M @ T((0.36 * math.cos(a), 0.36 * math.sin(a), 1.22)))
        rbox(f'en_line{i}', (0.035, 0.035, 0.62), M @ T((0.5 * math.cos(a), 0.5 * math.sin(a), 0.95), (0.42 * math.sin(a), -0.42 * math.cos(a), 0)), 'brass', 'props')
    for a in range(3):
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
    DW, DH = 5.2, 5.2
    box('doorframe_l', -DW - 0.5, -DW, -0.5, 0, 0, DH + 0.5, 'steel', 'center', bevel=0.03, M=M)
    box('doorframe_r', DW, DW + 0.5, -0.5, 0, 0, DH + 0.5, 'steel', 'center', bevel=0.03, M=M)
    box('doorframe_t', -DW - 0.5 - PROUD, DW + 0.5 + PROUD, -0.5 - PROUD, 0, DH, DH + 0.5 + PROUD, 'steel', 'center', bevel=0.03, M=M)
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
    g = 'center'

    def block(name, x0, x1, y0, y1, z0, z1, m, bevel=0):
        return box('gantry_' + name, x0, x1, y0, y1, z0, z1, m, g, bevel=bevel, M=M)

    def y_axis(x, y, z):
        return M @ T((x, y, z), (-pi / 2, 0, 0))

    for s in (-1, 1):
        y = s * .65
        block('top_flange', -6.47, 6.47, y-.20, y+.20, 6.92, 6.98, 'yellow', .012)
        block('bottom_flange', -6.47, 6.47, y-.20, y+.20, 6.59, 6.66, 'yellow', .012)
        block('girder_web', -6.47, 6.47, y-.045, y+.045, 6.65, 6.93, 'yellow')
        for x in (-6.18, -4.85, -2.7, 0, 2.7, 4.85, 6.18):
            block('web_stiffener', x-.031, x+.031, y-.155, y+.155, 6.653, 6.926, 'yellow')
    for x in (-4.85, -2.7, 2.7, 4.85):
        block('bridge_tie', x-.075, x+.075, -.62, .62, 6.86, 6.94, 'steel')

    for d in (-1, 1):
        x = d * 6.45
        block('truck_spine', x-.14, x+.14, -1.35, 1.35, 6.845, 6.963, 'steel', .013)
        for s in (-1, 1):
            y = s * 1.02
            fork = [(s*.49, 6.86), (s*1.34, 6.86), (s*1.34, 6.58),
                    (s*1.17, 6.46), (s*.88, 6.46), (s*.68, 6.61), (s*.49, 6.61)]
            for k in (-1, 1):
                prism('gantry_truck_cheek', fork, 'X', x+k*.11, x+k*.19, 'steel', g, M=M, bevel=.01)
                lathe('gantry_truck_bearing', [(0, 0), (.09, 0), (.09, .021), (.065, .036), (0, .036)],
                      't_light', g, segs=16, closed=False, M=M @ T((x+k*.185, y, 6.515), (0, k*pi/2, 0)))
            lathe('gantry_runway_wheel', [(0, -.113), (.172, -.113), (.174, -.091), (.155, -.075),
                                        (.155, .075), (.174, .091), (.172, .113), (0, .113)],
                  't_steel', g, segs=24, closed=False, M=M @ T((x, y, 6.515), (0, pi/2, 0)))
            block('truck_girder_seat', x-d*.23, x+d*.11, s*.47, s*.84, 6.585, 6.65, 'steel', .009)
            block('truck_buffer', x-.115, x+.115, s*1.31, s*1.44, 6.73, 6.87, 'rubber', .021)

    block('trolley_bed', -.79, .79, -.46, .46, 6.30, 6.41, 'steel', .014)
    for s in (-1, 1):
        for x in (-.65, .65):
            block('trolley_hanger', x-.077, x+.077, s*.35, s*.445, 6.38, 6.82, 'yellow', .013)
            lathe('gantry_trolley_wheel', [(0, -.075), (.079, -.075), (.079, -.064), (.105, -.064),
                                         (.105, .064), (.079, .064), (.079, .075), (0, .075)],
                  't_steel', g, segs=20, closed=False, M=y_axis(x, s*(.521 + PROUD), 6.765))
            rod('gantry_trolley_axle', (x, s*.33, 6.765), (x, s*.562, 6.765), .044, 't_light', g, M=M, n=12)

    drum_x, drum_z, drum_pitch = -.41, 6.07, .18
    sheave_z, pitch, rope = 5.04, .23, .016
    for s in (-1, 1):
        prism('gantry_drum_cheek', [(-.74, 6.325), (-.11, 6.325), (-.14, 6.085),
                                  (-.24, 5.935), (-.56, 5.90), (-.71, 6.015)],
              'Y', s*.145, s*.192, 'yellow', g, M=M, bevel=.013)
        lathe('gantry_drum_bearing', [(0, 0), (.108, 0), (.108, .032), (.081, .061), (0, .061)],
              'steel', g, segs=20, closed=False, M=M @ T((drum_x, s*.187, drum_z), (-s*pi/2, 0, 0)))
    lathe('gantry_rope_drum', [(0, -.15), (.083, -.15), (.083, -.09), (.207, -.09), (.207, -.06),
                             (.166, -.028), (.166, .028), (.207, .06), (.207, .09), (.083, .09),
                             (.083, .15), (0, .15)], 'steel', g, segs=32, closed=False, M=y_axis(drum_x, 0, drum_z))
    lathe('gantry_dead_end', [(0, 6.16), (.027, 6.16), (.054, 6.23), (.054, 6.315), (0, 6.315)],
          't_light', g, segs=16, closed=False, M=M @ T((pitch, 0, 0)))

    lathe('gantry_return_sheave', [(0, -.104), (.091, -.104), (.091, -.051), (.254, -.051), (.254, -.034),
                                 (.216, -.015), (.216, .015), (.254, .034), (.254, .051), (.091, .051),
                                 (.091, .104), (0, .104)], 'steel', g, segs=36, closed=False, M=y_axis(0, 0, sheave_z))
    for s in (-1, 1):
        prism('gantry_lower_cheek', [(-.105, 5.225), (.105, 5.225), (.177, 5.101), (.16, 4.935),
                                   (.081, 4.734), (-.081, 4.734), (-.16, 4.935), (-.177, 5.101)],
              'Y', s*.10, s*.148, 'yellow', g, M=M, bevel=.014)
    rod('gantry_sheave_pin', (0, -.177, sheave_z), (0, .177, sheave_z), .077, 't_light', g, M=M, n=20)

    def arc_section(cx, cz, r, start, end, steps):
        hand = 1 if end > start else -1
        for i in range(steps + 1):
            angle = start + (end - start) * i / steps
            nx, nz = math.cos(angle), math.sin(angle)
            yield cx + r*nx, cz + r*nz, hand*nx, hand*nz

    path = [*arc_section(drum_x, drum_z, drum_pitch, 3*pi/4, 0, 16),
            *arc_section(0, sheave_z, pitch, pi, 2*pi, 24), (pitch, 6.18, 1, 0)]
    bm = bmesh.new()
    prev = None
    for x, z, nx, nz in path:
        ring = []
        for i in range(8):
            a = i*pi/4
            v = rope * math.cos(a)
            ring.append(bm.verts.new((x + nx*v, rope*math.sin(a), z + nz*v)))
        if prev is None:
            bm.faces.new(list(reversed(ring)))
        else:
            for i in range(8):
                bm.faces.new((prev[i-1], prev[i], ring[i], ring[i-1])).smooth = True
        prev = ring
    bm.faces.new(prev)
    finish('gantry_reeved_rope', bm, 't_light', g, M=M)
    x, z, nx, nz = path[0]
    rod('gantry_drum_rope_clamp', (x+.038*nx, 0, z+.038*nz), (x-.02*nx, 0, z-.02*nz), .035, 't_steel', g, M=M)

    block('hook_crosshead', -.077, .077, -.149 + PROUD, .149 - PROUD, 4.731, 4.775, 'steel', .008)
    lathe('gantry_hook_swivel', [(0, 4.721), (.068, 4.721), (.076, 4.731), (.076, 4.766), (0, 4.766)],
          't_light', g, segs=20, closed=False, M=M)
    prism('gantry_forged_hook', [(-.065, 4.753), (-.151, 4.696), (-.218, 4.624), (-.208, 4.544),
                                (-.145, 4.493), (-.036, 4.487), (.055, 4.51), (.143, 4.569),
                                (.178, 4.642), (.156, 4.678), (.117, 4.652), (.080, 4.607),
                                (.03, 4.590), (-.038, 4.591), (-.102, 4.606), (-.105, 4.640),
                                (-.061, 4.687), (.046, 4.727), (.046, 4.753)],
          'Y', -.052, .052, 'yellow', g, M=M, bevel=.012)
    prism('gantry_safety_latch', [(-.09, 4.704), (.151, 4.666), (.145, 4.646), (-.094, 4.68)],
          'Y', -.029, .029, 't_light', g, M=M, bevel=.005)
    rod('gantry_latch_pin', (-.09, -.057, 4.695), (-.09, .057, 4.695), .017, 'steel', g, M=M, n=10)
    torus('gantry_master_link', .07, .022, M @ T((0, 0, 4.53), (0, pi/2, 0)) @ Matrix.Diagonal((1.15, 1, 1, 1)),
          'chrome', g, segs=24)
    return M @ Vector((0, 0, 4.45))


def a_solar_wing(M=I4, *, d=1):
    g = 'center'

    def part(name, size, xyz, mat_, bevel=0):
        return rbox('array_' + name, size, M @ T(xyz), mat_, g, bevel=bevel)

    part('root_foot', (.087, .39, .43), (d*.768, 0, 0), 't_light', .016)
    W = M @ T((d*.802, 0, 0), (0, d*pi/2, 0))
    lathe('array_drive', [(0, 0), (.164, 0), (.164, .125), (.144, .147), (.118, .147),
                          (.118, .235), (.091, .258), (0, .258)], 'steel', g, segs=24, closed=False, M=W)
    for s in (-1, 1):
        prism('array_root_fork', [(d*1.019, s*.04), (d*1.08, s*.055), (d*1.32, s*.44),
                                 (d*1.32, s*.563), (d*(1.21 + PROUD), s*.563), (d*1.012, s*.085)],
              'Y', -.014, .068, 't_light', g, M=M, bevel=.008)

    for i in range(3):
        cx = d * (1.72 + i * 1.08)
        part('backplane', (1.016, .042, 1.516), (cx, .012, 0), 't_paint')
        part('cell_face', (1.0, .012, 1.5), (cx, -.015, 0), 'solar')
        for s in (-1, 1):
            part('edge_rail', (.026, .069 + 2 * PROUD, 1.54), (cx+s*.507, .010, 0), 't_light', .003)
            part('edge_rail', (.99, .069 + PROUD, .023), (cx, .010, s*.758), 't_light', .003)
            part('rear_spar', (1.03, .033, .076), (cx, .045, s*.52), 't_steel', .006)
        a = d * (-1)**i
        prism('array_diagonal', [(cx-.46, -(.50+PROUD)*a), (cx-.46, -(.44+PROUD)*a), (cx+.46, (.50+PROUD)*a),
                                 (cx+.46, (.44+PROUD)*a)], 'Y', .030, .054, 't_light', g, M=M)
        for j in range(1, 6):
            part('cell_busbar', (1.0, .005, .005), (cx, -.021, -.75 + j*.25), 't_light')
        for j in range(1, 4):
            part('cell_grid', (.005, .005, 1.5), (cx-.5 + j*.25, -.022, 0), 't_light')
    part('junction_box', (.18, .054, .125), (d*1.48, .061, -.44), 't_black', .008)

    for joint in range(2):
        seam = d * (2.26 + joint*1.08)
        for z in (-.52, .52):
            for side, offsets in ((-1, (-.057, .057)), (1, (0,))):
                for dz in offsets:
                    part('hinge_leaf', (.139, .043, .048), (seam+side*.068, .062, z+dz), 't_light')
                    rod('array_hinge_knuckle', (seam, .082, z+dz-.024+PROUD), (seam, .082, z+dz+.024-PROUD),
                        .027, 'steel', g, M=M, n=12)
            rod('array_hinge_pin', (seam, .082, z-.093), (seam, .082, z+.093), .014, 'chrome', g, M=M, n=12)


def a_satellite(M=I4):
    def ngon(name, n, r, h, M, m, grp):
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=r, radius2=r, depth=h)
        return finish(name, bm, m, grp, M=M @ Matrix.Rotation(pi / n, 4, 'Z'))

    g = 'center'
    ngon('sat_bus', 8, .8, 1.7, M, 'dark', g)
    for z in (.89, -.89):
        ngon('sat_deck', 8, .84, .08, M @ T((0, 0, z)), 'steel', g)

    FR = .8 * math.cos(pi / 8)
    us = (-1, -.90, -.62, -.31, 0, .31, .62, .90, 1)
    vs = (-1, -.93, -.72, -.46, -.16, .12, .40, .66, .90, 1)
    for facet in range(8):
        bm = bmesh.new()
        rows = []
        for v in vs:
            row = []
            for u in us:
                tuck = min(1, 8*(1-abs(u)), 12*(1-abs(v)))
                fold = .028 + .012*math.sin(5*u + 2*v + .65*facet) + .008*math.sin(8*v - 2*u)
                row.append(bm.verts.new((FR-.005 + tuck*fold, .298*u, .846*v)))
            if rows:
                prev = rows[-1]
                for j in range(1, len(row)):
                    bm.faces.new((prev[j-1], prev[j], row[j], row[j-1])).smooth = True
            rows.append(row)
        finish('sat_thermal_blanket', bm, 'foil', g, M=M @ Matrix.Rotation(facet*pi/4, 4, 'Z'), keep_normals=True)

    lathe('sat_lift_collar', [(.25, .922), (.457, .922), (.457, .948), (.367, .961),
                             (.33, 1.012), (.285, 1.012), (.285, .964), (.25, .964)],
          't_light', g, segs=32, M=M)
    for i in range(4):
        L = M @ Matrix.Rotation(math.radians(21 + i*90), 4, 'Z')
        for s in (-1, 1):
            prism('sat_lift_clevis', [(.426, .924), (.622, .924), (.591, .968), (.54, .996), (.482, .980)],
                  'Y', s*.025, s*.052, 'steel', g, M=L, bevel=.006)
        rod('sat_lift_pin', (.526, -.065, .94), (.526, .065, .94), .019, 'chrome', g, M=L, n=16)
    lathe('sat_deck_port', [(0, .972), (.138, .972), (.16, .95), (.16, .924), (0, .924)],
          't_black', g, segs=20, closed=False, M=M)

    for a, kind in ((90, 'box'), (270, 'radiator'), (45, 'horn'), (135, 'service'), (225, 'imager'), (315, 'tracker')):
        Mf = M @ Matrix.Rotation(math.radians(a), 4, 'Z')
        if kind == 'box':
            rbox('sat_avionics', (.106, .42, .60), Mf @ T((FR+.052, 0, .10)), 'white', g, bevel=.014)
        elif kind == 'service':
            rbox('sat_service_case', (.11, .37, .58), Mf @ T((FR+.054, 0, -.29)), 't_light', g, bevel=.016)
        elif kind == 'radiator':
            for z in (-.55, .55):
                rbox('sat_radiator_mount', (.079, .51, .088), Mf @ T((FR+.036, 0, z)), 'steel', g, bevel=.008)
            rbox('sat_radiator_panel', (.046, .52, 1.23), Mf @ T((FR+.073, 0, 0)), 'white', g, bevel=.008)
            for y in (-.174, -.058, .058, .174):
                rod('sat_heat_pipe', (FR+.101, y, -.506), (FR+.101, y, .506), .013, 't_light', g, M=Mf)
            for z in (-.506, .506):
                rbox('sat_heat_manifold', (.034, .425, .052), Mf @ T((FR+.103, 0, z)), 'steel', g, bevel=.008)
        elif kind == 'horn':
            lathe('sat_horn', [(0, 0), (.055, 0), (.055, .063), (.164, .34), (.154, .34),
                              (.043, .08), (0, .08)], 'chrome', g, segs=24, closed=False,
                  M=Mf @ T((FR, 0, .30), (0, pi/2, 0)))
        elif kind == 'imager':
            rbox('sat_imager_cradle', (.14, .48, .53), Mf @ T((FR+.066, 0, .15)), 'steel', g, bevel=.026)
            O = Mf @ T((FR+.115, 0, .19), (0, pi/2, 0))
            lathe('sat_imager_barrel', [(0, 0), (.195, 0), (.207, .042), (.207, .128), (.177, .158),
                                       (.177, .348), (.200, .383), (.200, .420), (.160, .420),
                                       (.160, .142), (.145, .127), (0, .127)], 'white', g, segs=32, closed=False, M=O)
            lathe('sat_imager_baffles', [(.162, .151), (.162, .398), (.151, .398), (.151, .372),
                                        (.138, .360), (.151, .352), (.151, .308), (.138, .296),
                                        (.151, .288), (.151, .151)], 't_black', g, segs=32, M=O)
            lathe('sat_imager_objective', [(0, .247), (.07, .242), (.135, .223), (.153, .213),
                                           (.153, .199), (0, .199)], 't_glass', g, segs=32, closed=False, M=O)
        else:
            for dz in (-.42, -.16):
                lathe('sat_tracker', [(0, 0), (.074, 0), (.102, .21), (.091, .21), (.061, .06), (0, .06)],
                      't_black', g, segs=16, closed=False, M=Mf @ T((FR, 0, dz), (0, pi/2-.48, 0)))
    for a in (45, 135, 225, 315):
        Mq = M @ Matrix.Rotation(math.radians(a), 4, 'Z') @ T((0.86, 0, -0.8))
        rbox('sat_quad', (0.12, 0.12, 0.12), Mq, 'dark', 'center', bevel=0.01)
        for rx, ry in ((pi / 2, 0), (-pi / 2, 0), (0, pi / 2)):
            lathe('sat_thr', [(0, 0), (0.02, 0), (0.045, 0.1), (0.04, 0.1), (0.015, 0.01), (0, 0.01)], 'chrome', 'center', segs=10, closed=False, M=Mq @ T((0, 0, 0), (rx, ry, 0)) @ T((0, 0, 0.06)))
    A = M @ T((.04, .62, .923))
    lathe('sat_mast', [(0, 0), (.069, 0), (.069, .036), (.035, .065), (.018, .66), (0, .66)],
          'chrome', g, segs=16, closed=False, M=A)
    lathe('sat_omni', [(0, 0), (.057, .019), (.057, .10), (0, .142)],
          'white', g, segs=16, closed=False, M=A @ T((0, 0, .655)))
    lathe('sat_dish', [(0, 0.0), (0.25, 0.03), (0.5, 0.12), (0.72, 0.28), (0.74, 0.28), (0.5, 0.1), (0.25, 0.01), (0, -0.02)], 'white', 'center', segs=48, closed=False, M=M @ T((0, 0, -1.28), (pi, 0, 0)))
    for leg in range(3):
        a = leg*2*pi/3
        rod('dish_stay',(.36*math.cos(a),.36*math.sin(a),-.925),(.15*math.cos(a),.15*math.sin(a),-1.29),.018,'steel','center',M=M)
    lathe('sat_feed', [(0, 0.0), (0.03, 0.0), (0.03, 0.5), (0.07, 0.56), (0, 0.6)], 'chrome', 'center', segs=12, closed=False, M=M @ T((0, 0, -1.3), (pi, 0, 0)))
    for d in (-1, 1):
        a_solar_wing(M, d=d)


EXHIBIT_ASSETS = dict(rover=a_rover, arm=a_manipulator, engine=a_engine, lattice=a_lattice, plinth=a_plinth,
                      gantry=a_gantry, satellite=a_satellite, solar_wing=a_solar_wing, cargo_bulkhead=a_cargo_bulkhead)
