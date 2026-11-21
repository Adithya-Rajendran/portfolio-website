"""Lounge furniture builders, loaded into the room's shared-kit namespace."""


def a_coffee_table(M=I4, grp='props'):
    """Walnut top, rails and turned legs, with the origin at the floor centre."""
    box('table_top', -0.75, 0.75, -0.85, 0.85, 0.34, 0.38, 'wood_l', grp, bevel=0.012, M=M)
    # Mortised aprons meet the four turned legs instead of a solid box underneath.
    for x in (-0.68, 0.68):
        box('table_apron', x - 0.016, x + 0.016, -0.78, 0.78, 0.261, 0.34, 'wood', grp, bevel=0.004, M=M)
    for y in (-0.78, 0.78):
        box('table_endrail', -0.68, 0.68, y - 0.016, y + 0.016, 0.261, 0.34, 'wood', grp, bevel=0.004, M=M)
    for x in (-0.68, 0.68):
        for y in (-0.78, 0.78):
            turned('table_leg', 0.34, 0.035, 'wood', grp, M=M @ T((x, y, 0)), segs=10)


def a_sideboard(M=I4, grp='props'):
    """Cabinet including pulls and feet; origin on the wall at floor level, facing -x."""
    box('sideboard', -0.6, -0.02, -2.2, 2.2, 0.12, 0.85, 'wood', grp, bevel=0.012, M=M)
    box('sideboard_top', -0.63, -0.02, -2.25, 2.25, 0.85, 0.89, 'wood_l', grp, bevel=0.008, M=M)
    for k in range(4):
        box('sideboard_door', -0.615, -0.6, -2.15 + k * 1.09, -1.13 + k * 1.09, 0.17, 0.8,
            'wood_l', grp, bevel=0.006, M=M)

    for k in range(4):
        y = -1.64 + k * 1.09 + (0.42 if k % 2 == 0 else -0.42)
        lathe('sb_knob', [(0, 0.03), (0.014, 0.03), (0.018, 0.02), (0.007, 0.01), (0.007, 0), (0, 0)],
              'brass', grp, segs=10, closed=False, M=M @ T((-0.615, y, 0.5), (0, -pi / 2, 0)))
    for y in (-2.1, 0, 2.1):
        for x in (-0.52, -0.1):
            turned('sb_foot', 0.12, 0.03, 'wood', grp, M=M @ T((x, y, 0)), segs=10)


def a_sofa_body(M=I4, grp='props', *, name='sofaL', L=2.8, face=1):
    """Low sofa along y, facing face * x, with its origin at the floor centre.

    The original feet belong to the body; the additional trim is placed separately.
    """
    y0, y1 = -L / 2, L / 2
    b = -face * 0.5
    box(name + 'base', -0.5, 0.5, y0, y1, 0.08, 0.22, 'wood', grp, M=M)
    span = (L - 0.16) / 3
    for k in range(3):
        yy = y0 + 0.08 + span * k
        boxed_cushion(name + 'seat', M @ T((0, yy + span / 2, 0.325)), 0.94, span - 0.01, 0.21, 'linen', grp)
    for x in (-0.38, 0.38):
        for y in (y0 + 0.14, y1 - 0.14):
            turned('sofa_foot', 0.08, 0.04, 'wood', grp, M=M @ T((x, y, 0)))
    box(name + 'back', min(b, b + face * 0.2), max(b, b + face * 0.2), y0, y1, 0.22, 0.86,
        'linen', grp, bevel=0.07, seg=3, M=M)
    for y in (y0, y1):
        box(name + 'arm', -0.5, 0.5, y - 0.09, y + 0.09, 0.22, 0.62, 'linen', grp, bevel=0.06, seg=3, M=M)
    for k in range(3):
        y = y0 + (k + 0.5) * L / 3
        rbox(name + 'cushion', (0.14, 0.5, 0.46), M @ T((b + face * 0.3, y, 0.62), (0, -face * 0.25, 0)),
             random.choice(('rug', 'linen', 'rug2')), grp, bevel=0.05, seg=3)


def a_telescope(M=I4, grp='props', target=(-5.6, 8.1, 4.6)):
    """Brass telescope with the tripod centred at the local floor origin.

    Target is a point in the asset's local coordinates, sighted from the tripod head.
    """
    head = Vector((0, 0, 1.45))
    for a in range(3):
        ang = a * 2 * pi / 3 + 0.3
        foot = Vector((0.55 * math.cos(ang), 0.55 * math.sin(ang), 0))
        leg = head - foot
        q = leg.to_track_quat('Z', 'Y')
        rbox('scope_leg', (0.04, 0.04, leg.length), M @ Matrix.Translation((head + foot) / 2) @ q.to_matrix().to_4x4(), 'wood_l', grp)
    aim = (Vector(target) - head).normalized()
    Mq = M @ Matrix.Translation(head + Vector((0, 0, 0.1))) @ aim.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    lathe('scope_tube', [(0, -0.55), (0.055, -0.55), (0.055, 0.5), (0.075, 0.5), (0.075, 0.62), (0.065, 0.62), (0.065, 0.52), (0, 0.52)], 'brass', grp, segs=24, closed=False, M=Mq)
    lathe('scope_eye', [(0, -0.72), (0.028, -0.72), (0.028, -0.55), (0, -0.55)], 'dark', grp, segs=16, closed=False, M=Mq)
    lathe('scope_mount', [(0, 0.1), (0.06, 0.1), (0.06, 0), (0, 0)], 'dark', grp, segs=16, closed=False, M=M @ T(head))
    for z in (-0.25, 0.22):
        torus('scope_saddle_band', 0.057, 0.009, Mq @ T((0, 0, z)), 'dark', grp, segs=32)
    rod('scope_saddle', (0, -0.064, -0.27), (0, -0.064, 0.24), 0.017, 'dark', grp, M=Mq)
    rod('scope_focuser', (-0.085, 0, -0.54), (0.085, 0, -0.54), 0.009, 'brass', grp, M=Mq)
    for d in (-1, 1):
        lathe('scope_focus_wheel', [(0, -0.008), (0.033, -0.008), (0.033, 0.008), (0, 0.008)], 'dark', grp, segs=20, M=Mq @ T((d * 0.08, 0, -0.54), (0, pi / 2, 0)))
