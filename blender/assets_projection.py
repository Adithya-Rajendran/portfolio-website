"""Atrium and Navigation assets, executed after the shared mesh/material kit.

Navigation supplies leather, EM_core and EM_riblight before building or benching
its assets. The orrery uses the shared chandelier palette; its motion is external.
"""


def _projection_materials():
    # Lazy registration: both rooms and their isolated benches have the shared mat() kit.
    for name, rgb, rough, metal, coat in (
        ('projection_cast', (.32, .37, .43), .34, .52, 0),
        ('projection_baffle', (.012, .015, .020), .67, .04, 0),
        ('projection_optic', (.022, .065, .088), .105, .24, .62),
    ):
        if name not in MAT:
            mat(name, rgb, rough, metal, coat=coat)


def _projection_frame(M, a, r=0, z=0):
    """Local X points radially out, Y is tangential, Z is up."""
    return M @ Matrix.Rotation(a, 4, 'Z') @ T((r, 0, z))


def _projection_hex(name, M, grp, r=.018, h=.012):
    head = lathe(name, [(0, 0), (r, 0), (r, h * .7), (r * .83, h), (0, h)],
                 'chrome', grp, segs=6, closed=False, M=M)
    for face in head.data.polygons:
        face.use_smooth = False


def _projection_optics(M, grp, *, z, bore, outer, bezel, lens, em, keepers):
    """Lift-out optical cartridge. Mouth at z, with two knife-edge stops ahead of a seated objective."""
    A = M @ T((0, 0, z))
    rim = lathe(bezel, [(bore - .003, -.012), (bore + .012, 0), (outer - .053, 0),
                       (outer - .041, -.018), (outer - .041, -.028), (outer - .009, -.028),
                       (outer, -.038), (outer, -.066), (bore + .032, -.066), (bore + .032, -.016)],
                'projection_cast', grp, segs=64, M=A)
    # The stop faces rake away from their apertures. The outer wall is continuous and opaque.
    barrel = lathe(f'{lens}_barrel', [(bore + .042, -.016), (bore, -.016), (bore * .97, -.032),
                                    (bore * .97, -.050), (bore * .85, -.060), (bore * .85, -.065),
                                    (bore * .96, -.081), (bore * .96, -.094), (bore * .72, -.105),
                                    (bore * .72, -.110), (bore * .90, -.127), (bore * .90, -.154),
                                    (bore * .57, -.154), (bore * .57, -.173), (bore + .042, -.173)],
                   'projection_baffle', grp, segs=48, M=A)
    for part in (rim, barrel):
        part.data.set_sharp_from_angle(angle=math.radians(38))
    # Blind rear cell supports the objective and closes the underside of the cartridge.
    lathe(f'{lens}_cell', [(0, -.197), (bore * .66, -.197), (bore * .68, -.178), (bore * .68, -.167),
                          (bore * .39, -.167), (bore * .39, -.141), (0, -.141)],
          'projection_baffle', grp, segs=32, closed=False, M=A)
    # Curved objective around the working emitter; nothing opaque sits across the pupil.
    lathe(f'{lens}_objective', [(bore * q, d) for q, d in ((.412, -.135), (.51, -.136), (.69, -.142),
                                                           (.89, -.152), (.89, -.159), (.41, -.159))],
          'projection_optic', grp, segs=48, M=A)
    lathe(lens, [(0, -.132), (bore * .23, -.133), (bore * .412, -.135), (bore * .412, -.143), (0, -.143)],
          em=em, segs=48, closed=False, M=A)
    for i in range(keepers):
        B = _projection_frame(A, 2 * pi * i / keepers, outer - .043, -.022)
        rbox(f'{lens}_keeper', (.070, .120, .018), B, 'brass', grp, bevel=.005, seg=1)
        _projection_hex(f'{lens}_keeper_bolt', B @ T((.018, 0, .008)), grp, r=.014, h=.010)


def a_reception_desk(M=I4, grp='center', *, a0=math.radians(-56), a1=math.radians(56), index=0):
    """One curved counter, with angles in radians about the dais axis and its foot at local z=.14."""
    _projection_materials()
    lathe(f'desk{index}', [(2.27, .14), (2.28, .22), (2.59, .90), (2.67, 1.04), (2.75, 1.12),
                          (1.98, 1.12), (1.98, 1.0), (2.06, .14)],
          'wall2', grp, segs=48, a0=a0, a1=a1, M=M)
    lathe(f'desk_toe{index}', [(2.23, .14), (2.30, .14), (2.32, .20), (2.28, .22), (2.22, .22)],
          'projection_cast', grp, segs=48, a0=a0 + PROUD / 2.2, a1=a1 - PROUD / 2.2, M=M)
    # Four removable fascia panels stand off from the carcass; the arc ends read as folded returns.
    pitch = (a1 - a0) / 4
    for i in range(4):
        lathe(f'desk_fascia{index}', [(2.273, .254), (2.324, .246), (2.36, .284), (2.65, .849),
                                    (2.67, .920), (2.590, .920), (2.550, .824), (2.250, .260)],
              'white', grp, segs=5, a0=a0 + (i + .035) * pitch, a1=a0 + (i + .965) * pitch,
              M=M, bevel=.008, seg=1)
    lathe(f'desk_header{index}', [(2.615, .984), (2.724, .984), (2.764, 1.006), (2.78, 1.063),
                                  (2.78, 1.12), (2.674, 1.12)],
          'projection_cast', grp, segs=64, a0=a0 + PROUD / 2.6, a1=a1 - PROUD / 2.6, M=M)
    lathe(f'desk_top{index}', [(1.94, 1.12), (2.82, 1.12), (2.82, 1.16), (1.94, 1.16)],
          'glasstop', grp, segs=64, a0=a0 - 0.012, a1=a1 + 0.012, M=M)
    lathe(f'desk_led{index}', [(2.677, .978), (2.713, .978), (2.713, .986), (2.677, .986)],
          em='cyan', segs=64, a0=a0 + .02, a1=a1 - .02, M=M)


def a_projector(M=I4, grp='center'):
    """Atrium's projector pedestal, from the dais at z=.14 to the barrel mouth at z=.54."""
    _projection_materials()
    lathe('holo_base', [(.27, .14), (.63, .14), (.63, .192), (.55, .393), (.57, .477), (.48, .477),
                       (.48, .31), (.27, .31)], 'dark', grp, segs=64, M=M)
    lathe('holo_foot', [(.61, .14), (.70, .14), (.70, .166), (.68, .186), (.61, .186)],
          'projection_cast', grp, segs=64, M=M)
    # Clear gaps between the cast skins and under the crown, with captive panel screws on the slopes.
    for i in range(8):
        a = i * pi / 4
        lathe('holo_skin', [(.617, .203), (.663, .203), (.673, .223), (.615, .372), (.580, .426),
                            (.545, .426), (.560, .370), (.625, .225)], 'projection_cast', grp,
              segs=4, a0=a - .365, a1=a + .365, M=M, bevel=.006, seg=1)
        B = _projection_frame(M, a, .604, .382) @ T((0, 0, 0), (0, math.radians(58), 0))
        _projection_hex('holo_skin_screw', B, grp)
    lathe('holo_cartridge_seat', [(.488, .434), (.563, .434), (.596, .454), (.600, .478), (.488, .478)],
          'brass', grp, segs=64, M=M)
    _projection_optics(M, grp, z=.54, bore=.449, outer=.600, bezel='holo_ring', lens='holo_lens', em='cyan', keepers=6)


def a_gimbal_ring(M=I4, grp='chandA', *, radius=3.3, index=0, a0=0.0, lit_arc=math.radians(205)):
    """One gimbal in its local XY plane, with an inner and underside light arc (radians)."""
    rr = radius; a1 = a0 + lit_arc
    lathe(f'chand{index}', [(rr - 0.045, -0.09), (rr + 0.045, -0.09), (rr + 0.045, 0.09), (rr - 0.045, 0.09)],
          'chrome', grp, segs=192, M=M)
    lathe(f'chandled{index}', [(rr - 0.053, -0.06), (rr - 0.045, -0.06), (rr - 0.045, 0.06), (rr - 0.053, 0.06)],
          em=grp, segs=128, a0=a0, a1=a1, M=M)
    lathe(f'chandled_b{index}', [(rr - 0.03, -0.098), (rr + 0.03, -0.098), (rr + 0.03, -0.09), (rr - 0.03, -0.09)],
          em=grp, segs=128, a0=a0, a1=a1, M=M)


def a_orrery(M=I4, grp='archC', *, stem_rise=4.2):
    """The Atrium chandelier, with M at the hub and stem_rise measured to the ceiling."""
    _projection_materials()
    # Fixed suspension: ceiling flange, draw tube and the rotary feedthrough above the hub.
    lathe('chand_canopy', [(0, -.34), (.10, -.34), (.15, -.30), (.238, -.116), (.30, -.116), (.30, 0), (0, 0)],
          'projection_cast', grp, segs=32, closed=False, M=M @ T((0, 0, stem_rise)))
    for i in range(4):
        B = _projection_frame(M, pi * (i + .5) / 2, .265, stem_rise - .114)
        _projection_hex('chand_canopy_bolt', B @ T((0, 0, 0), (pi, 0, 0)), grp, r=.024, h=.018)
    lathe('chand_stem', [(0, .13), (.064, .13), (.064, stem_rise - .28), (0, stem_rise - .28)],
          'chrome', grp, segs=24, closed=False, M=M)
    lathe('chand_hub', [(0, -.16), (.15, -.106), (.20, -.047), (.20, .065), (.171, .102),
                       (.111, .102), (.111, .132), (0, .132)], 'brass', grp, segs=32, closed=False, M=M)
    lathe('chand_feedthrough', [(.062, .117), (.13, .117), (.15, .157), (.15, .24), (.113, .28),
                               (.113, .48), (.085, .52), (.062, .52)], 'projection_cast', grp, segs=24, M=M)
    # Moving rings keep their original frames and A/B tags.
    rings = ((3.3, 20, 22, 'chandA', 205), (2.6, 100, -34, 'chandB', 215), (1.9, 200, 48, 'chandA', 230))
    for i, (rr, az, tilt, tag, arc) in enumerate(rings):
        axis = Vector((math.cos(math.radians(az)), math.sin(math.radians(az)), 0))
        Mr = M @ Matrix.Rotation(math.radians(tilt), 4, axis)
        a_gimbal_ring(Mr, tag, radius=rr, index=i, a0=math.radians(70 * i), lit_arc=math.radians(arc))


def a_wall_seat(M=I4, grp='props', *, index=0):
    """Navigation's built-in seat and base; M is the bay frame with +X toward the wall."""
    rbox(f'seat{index}', (0.55, 2.6, 0.1), M @ T((-0.34, 0, 0.5)), 'leather', grp, bevel=0.03, seg=3)
    rbox(f'seatbase{index}', (0.5, 2.5, 0.42), M @ T((-0.32, 0, 0.24)), 'wall2', grp)


def a_dome_rib(M=I4, grp='archR', *, azimuth=0.0, radius=9.0, wall_h=3.6, apex=8.4, oculus=1.7, index=0):
    """Navigation's floor-to-oculus rib and light strip, about the drum axis at azimuth (radians)."""
    def rib_path(off):
        pts = [(radius - off, 0.0), (radius - off, wall_h)]
        for t in range(1, 25):
            a = t * pi / 2 / 24
            r0 = oculus + (radius - oculus) * math.cos(a); z0 = wall_h + (apex - wall_h) * math.sin(a)
            nx, nz = math.cos(a) * (apex - wall_h), math.sin(a) * (radius - oculus)
            n = math.hypot(nx, nz)  # ellipse normal
            pts.append((r0 - off * nx / n, z0 - off * nz / n))
        return pts

    # Keep azimuth in the lathe angles, not a post-rotation, to reproduce the original vertex coordinates and order.
    M = None if M is I4 else M
    lathe(f'rib{index}', rib_path(-0.02) + list(reversed(rib_path(0.32))), 'rib', grp,
          segs=2, a0=azimuth - 0.03, a1=azimuth + 0.03, M=M)
    lathe(f'ribled{index}', rib_path(0.322) + list(reversed(rib_path(0.332))), em='riblight',
          segs=1, a0=azimuth - 0.0035, a1=azimuth + 0.0035, M=M)


def a_map_table(M=I4, grp='center', *, radius=3.1, height=0.62):
    """Navigation's table; preserve the chart datum and build the barrel down into the deck."""
    _projection_materials()
    R, Ht = radius, height
    D = M @ T((0, 0, Ht))
    lathe('table', [(.61, Ht * .035), (R - .535, Ht * .035), (R - .535, Ht * .08),
                    (R - .211, Ht * .795), (R - .211, Ht - .069), (.61, Ht - .069)],
          'dark', grp, segs=96, M=M)
    lathe('table_foot', [(R - .57, 0), (R - .50, 0), (R - .50, Ht * .075),
                         (R - .52, Ht * .123), (R - .57, Ht * .123)], 'plat', grp, segs=96, M=M)
    for i in range(12):
        a = (i + .5) * pi / 6
        # Coarse cover facets, chamfered ends and open seams against the dark structural skirt.
        lathe('table_skirt_panel', [(R + dr, Ht * f) for dr, f in ((-.510, .159), (-.450, .159),
              (-.405, .230), (-.243, .611), (-.208, .717), (-.272, .717), (-.323, .609), (-.511, .223))],
              'projection_cast', grp, segs=4, a0=a - .248, a1=a + .248, M=M, bevel=.006, seg=1)
        B = _projection_frame(M, a, R - .235, Ht * .644) @ T((0, 0, 0), (0, math.radians(62), 0))
        _projection_hex('table_panel_screw', B, grp, r=.023, h=.013)

    # Cast deck and undercut: the existing light washes down from inside the eave.
    lathe('table_deck', [(.619, -.090), (R - .225, -.090), (R - .183, -.120), (R - .070, -.120),
                         (R - .015, -.095), (R, -.067), (R, -.013), (R - .059, -.013),
                         (R - .059, -.026), (R - .249, -.026), (R - .249, -.012), (.619, -.012)],
          'projection_cast', grp, segs=128, M=D)
    lathe('table_led', [(R - .165, -.128), (R - .098, -.128), (R - .098, -.118), (R - .165, -.118)],
          em='stair', segs=96, M=D)
    lathe('table_glass', [(.632, -.017), (R - .249, -.017), (R - .249, .004), (.632, .004)],
          'glasstop', grp, segs=96, M=D)
    for r in (.9, 1.7, 2.5):
        lathe(f'table_ring{r}', [(r, .006), (r + .02, .006)], 'brass', grp, segs=96, closed=False, M=D)
    _projection_optics(M, grp, z=Ht + .05, bore=.510, outer=.655, bezel='lens_ring', lens='lens', em='core', keepers=4)

    # Scale ring in a machined channel. Its fixed outer race has pockets for four retainer shoes.
    lathe('table_glass_bezel', [(R - .277, -.014), (R - .241, -.014), (R - .241, .009),
                               (R - .251, .016), (R - .275, .016)], 'brass', grp, segs=128, M=D)
    lathe('azimuth_dial', [(R - .233, -.025), (R - .064, -.025), (R - .064, -.001),
                          (R - .074, .006), (R - .225, .006), (R - .233, -.001)],
          'projection_baffle', grp, segs=128, M=D)
    for degree in range(0, 360, 5):
        length, width = (.132, .026) if degree % 30 == 0 else ((.089, .017) if degree % 15 == 0 else (.045, .011))
        B = _projection_frame(D, math.radians(degree), R - .081 - length / 2, .006)
        rbox('azimuth_division', (length, width, .004), B, 'brass', grp)
    for i in range(4):
        a = i * pi / 2
        lathe('table_rim', [(R - .055, -.014), (R + .005, -.014), (R + .020, -.003),
                            (R + .020, .020), (R + .005, .030), (R - .042, .030), (R - .055, .014)],
              'brass', grp, segs=32, a0=a + .085 / R, a1=a + pi / 2 - .085 / R, M=D)
        B = _projection_frame(D, a, R)
        rbox('azimuth_retainer', (.079, .150, .045), B @ T((-.024, 0, .005)),
             'projection_cast', grp, bevel=.006, seg=1)
        _projection_hex('azimuth_retainer_bolt', B @ T((-.018, 0, .026)), grp, h=.011)
        if i == 3:  # Fixed witness at the approach side, projecting over (not touching) the scale.
            prism('azimuth_index', [(-.147, 0), (-.058, -.035), (-.058, .035)], 'Y', -.007, .007,
                  'brass', grp, M=B @ T((0, 0, .020), (pi / 2, 0, 0)))


ATRIUM_PROJECTION = {
    'reception_desk': a_reception_desk,
    'projector': a_projector,
    'orrery': a_orrery,
    'gimbal_ring': a_gimbal_ring,
}
NAVIGATION_PROJECTION = {
    'map_table': a_map_table,
    'wall_seat': a_wall_seat,
    'dome_rib': a_dome_rib,
}
