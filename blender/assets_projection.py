"""Atrium and Navigation assets, executed after the shared mesh/material kit.

Navigation supplies leather, EM_core and EM_riblight before building or benching
its assets. The orrery uses the shared chandelier palette; its motion is external.
"""


def a_reception_desk(M=I4, grp='center', *, a0=math.radians(-56), a1=math.radians(56), index=0):
    """One curved counter, with angles in radians about the dais axis and its foot at local z=.14."""
    lathe(f'desk{index}', [(2.3, 0.14), (2.78, 1.02), (2.78, 1.12), (1.98, 1.12), (1.98, 1.0), (2.06, 0.14)],
          'white', grp, segs=64, a0=a0, a1=a1, M=M)
    lathe(f'desk_top{index}', [(1.94, 1.12), (2.82, 1.12), (2.82, 1.16), (1.94, 1.16)],
          'glasstop', grp, segs=64, a0=a0 - 0.012, a1=a1 + 0.012, M=M)
    lathe(f'desk_led{index}', [(2.7, 0.94), (2.745, 1.01), (2.76, 1.01), (2.715, 0.94)],
          em='cyan', segs=64, a0=a0 + 0.02, a1=a1 - 0.02, M=M)


def a_projector(M=I4, grp='center'):
    """The Atrium's projector pedestal, with its foot at local z=.14."""
    lathe('holo_base', [(0, 0.5), (0.5, 0.5), (0.62, 0.4), (0.7, 0.14), (0, 0.14)],
          'dark', grp, segs=64, closed=False, M=M)
    lathe('holo_ring', [(0.5, 0.5), (0.6, 0.5), (0.6, 0.54), (0.5, 0.54)], 'chrome', grp, segs=64, M=M)
    # Segmented keeper ring: the emitter cartridge can be lifted out from above.
    for i in range(12):
        B = M @ Matrix.Rotation(i * pi / 6, 4, 'Z') @ T((.466, 0, .515))
        rbox('lens_keeper', (.062, .082, .018), B, 'dark', grp, bevel=.005)
        lathe('keeper_bolt', [(0, .009), (.011, .009), (.011, .016), (0, .016)], 'chrome', grp, segs=6, M=B)
    lathe('holo_lens', [(0, 0.505), (0.44, 0.505), (0.44, 0.515), (0, 0.515)], em='cyan', segs=64, closed=False, M=M)


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
    lathe('chand_stem', [(0, 0), (0.045, 0), (0.045, stem_rise - 0.6), (0.3, stem_rise - 0.35),
                        (0.3, stem_rise - 0.3), (0, stem_rise - 0.3)], 'chrome', grp, segs=24, closed=False, M=M)
    lathe('chand_hub', [(0, 0.16), (0.16, 0.08), (0.2, 0), (0.16, -0.08), (0, -0.16)],
          'brass', grp, segs=24, closed=False, M=M)
    # Radius, tilt axis azimuth, tilt, spin tag, lit arc (angles in degrees).
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
    """Navigation's table; the radius sets the rim, with fixed-size chart rings and optics inside it."""
    def radial_frame(degree, r, z):
        a = math.radians(degree)
        return M @ (Matrix.Translation((r * math.cos(a), r * math.sin(a), z)) @ Matrix.Rotation(a, 4, 'Z'))

    lathe('table', [(0, height), (radius, height), (radius, height - 0.1), (radius - 0.16, height - 0.1), (radius - 0.5, 0.0)],
          'plat', grp, segs=128, closed=False, M=M)
    lathe('table_led', [(radius - 0.15, height - 0.115), (radius - 0.03, height - 0.115), (radius - 0.03, height - 0.105), (radius - 0.15, height - 0.105)],
          em='stair', segs=128, M=M)
    lathe('table_rim', [(radius - 0.02, height), (radius + 0.02, height), (radius + 0.02, height + 0.03), (radius - 0.02, height + 0.03)],
          'brass', grp, segs=128, M=M)
    lathe('table_glass', [(0, height + 0.004), (radius - 0.02, height + 0.004)], 'glasstop', grp, segs=96, closed=False, M=M)
    for r in (0.9, 1.7, 2.5):
        lathe(f'table_ring{r}', [(r, height + 0.006), (r + 0.02, height + 0.006)], 'brass', grp, segs=96, closed=False, M=M)
    lathe('lens', [(0, height + 0.008), (0.5, height + 0.008)], em='core', segs=48, closed=False, M=M)
    lathe('lens_ring', [(0.5, height), (0.62, height), (0.62, height + 0.05), (0.5, height + 0.05)], 'chrome', grp, segs=48, M=M)
    # Engraved azimuth scale on an annular brass dial. Long divisions can be read from the aisle.
    lathe('azimuth_dial', [(radius - .166, height + .012), (radius - .037, height + .012)], 'brass', grp, segs=128, closed=False, M=M)
    for degree in range(0, 360, 3):
        length = .095 if degree % 30 == 0 else (.057 if degree % 15 == 0 else .028)
        rbox('azimuth_division', (length, .009, .002), radial_frame(degree, radius - .045 - length / 2, height + .014), 'dark', grp)
    for quadrant in range(4):
        B = radial_frame(quadrant * 90, .57, height + .051)
        rbox('optical_clamp', (.085, .125, .016), B, 'dark', grp, bevel=.005)
        for dy in (-.043, .043):
            lathe('clamp_screw', [(0, .008), (.012, .008), (.012, .014), (0, .014)], 'chrome', grp, segs=6, M=B @ T((0, dy, 0)))


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
