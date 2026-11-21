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
