"""Fabrication exhibit assets, using the shared kit and the room's material palette.

Coordinates are in metres. M places the plinth at floor level and the other assets
at plinth-top level. Indexed builders take i as the suffix for their part names.
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


EXHIBIT_ASSETS = dict(rover=a_rover, arm=a_manipulator, engine=a_engine, lattice=a_lattice, plinth=a_plinth)
