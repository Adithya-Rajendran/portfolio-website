"""
Station hardware: the working assets shared by the Atrium, Fabrication and Navigation (tool chests, control cabinets,
consoles, ducts, drums, barriers ...). Executed by a room script after the shared kit; every asset builds itself at a
placement M and can be shown alone with ASSET=<name> (see bench() in build_scene.py).
"""
mat('t_steel', (0.17, 0.18, 0.2), 0.42, 0.7, var=0.1); mat('t_paint', (0.3, 0.32, 0.35), 0.5, var=0.08); mat('t_light', (0.62, 0.64, 0.67), 0.4, var=0.06)
mat('t_orange', (0.75, 0.2, 0.03), 0.45, 0.0, 1.5, 0.4, var=0.08); mat('t_yellow', (0.8, 0.5, 0.03), 0.45, 0.0, 1.5, 0.3, var=0.1); mat('t_red', (0.55, 0.03, 0.02), 0.35, 0.0, 1.5, 0.6)
mat('t_black', (0.02, 0.02, 0.024), 0.5); mat('t_rubber', (0.02, 0.02, 0.022), 0.8); mat('t_chrome', (0.86, 0.88, 0.9), 0.1, 1.0); mat('t_glass', (0.02, 0.03, 0.04), 0.04, 0.0, 1.6, 1.0)
mat('t_seat', (0.05, 0.07, 0.11), 0.6); mat('t_label', (0.8, 0.8, 0.76), 0.6)
EM.update({'t_ok': ((0.3, 1.0, 0.5), 3.0), 't_warn': ((1.0, 0.5, 0.1), 3.0), 't_cy': ((0.25, 0.8, 1.0), 2.4), 't_work': ((1.0, 0.85, 0.7), 6.0)})
for _k in ('t_ok', 't_warn', 't_cy', 't_work'): mat('EM_' + _k, (0, 0, 0), 0.5, emis=EM[_k][0], estr=EM[_k][1])

def _bolts(M, grp, pts, r=0.008, m='t_chrome'):
    for p in pts: blob('bolt', M @ Vector(p), r, m, grp)
def _castors(M, grp, pts, r=0.04):
    for x, y in pts:
        lathe('castor', [(0, -0.014), (r, -0.014), (r, 0.014), (0, 0.014)], 't_rubber', grp, segs=12, M=M @ T((x, y, r), (pi / 2, 0, 0))); rod('castor_fork', (x, y, r), (x, y, 2 * r + 0.02), 0.008, 't_steel', grp, M=M)

def a_toolchest(M=I4, grp='props'):
    """A rolling tool chest (drawers face +x): cabinet below, top box with a raised lid, a few tools left on it."""
    _castors(M, grp, ((-0.2, -0.36), (-0.2, 0.36), (0.2, -0.36), (0.2, 0.36)))
    box('chest_body', -0.26, 0.26, -0.42, 0.42, 0.1, 0.92, 't_orange', grp, bevel=0.012, M=M); box('chest_top', -0.24, 0.24, -0.4, 0.4, 0.94, 1.26, 't_orange', grp, bevel=0.012, M=M)
    box('chest_mat', -0.27, 0.27, -0.43, 0.43, 0.92, 0.94, 't_rubber', grp, M=M); box('chest_lid', -0.25, 0.25, -0.41, 0.41, 1.26, 1.275, 't_orange', grp, bevel=0.006, M=M)
    for z0, hs in ((0.14, (0.2, 0.2, 0.12, 0.12, 0.08)), (0.96, (0.1, 0.08, 0.08))):
        z = z0
        for hh in hs:
            box('chest_drawer', 0.26, 0.268, -0.4, 0.4, z + 0.005, z + hh - 0.005, 't_orange', grp, bevel=0.003, M=M); box('chest_pull', 0.268, 0.282, -0.36, 0.36, z + hh - 0.03, z + hh - 0.014, 't_chrome', grp, M=M); z += hh
    rod('chest_handle', (-0.3, -0.3, 0.8), (-0.3, 0.3, 0.8), 0.012, 't_chrome', grp, M=M)
    for y in (-0.3, 0.3): rod('chest_hb', (-0.26, y, 0.8), (-0.3, y, 0.8), 0.01, 't_chrome', grp, M=M)
    rod('wrench', (0.0, -0.2, 1.275), (0.1, 0.1, 1.275), 0.009, 't_chrome', grp, M=M); rbox('drillcase', (0.2, 0.28, 0.08), M @ T((-0.05, 0.22, 1.3)), 't_black', grp, bevel=0.01)

def a_cabinet(M=I4, grp='props', h=2.0, rise=1.6):
    """An electrical cabinet against a wall at x = 0 (door faces +x): louvres, a handle, status lamps, a warning plate, conduit rising to the tray."""
    box('cab_body', 0, 0.42, -0.4, 0.4, 0.08, h, 't_paint', grp, bevel=0.012, M=M); box('cab_plinth', 0.02, 0.4, -0.38, 0.38, 0, 0.08, 't_black', grp, M=M)
    box('cab_door', 0.42, 0.435, -0.37, 0.37, 0.12, h - 0.04, 't_light', grp, bevel=0.006, M=M)
    for k in range(6): box('cab_louvre', 0.435, 0.45, -0.28, 0.28, 0.24 + k * 0.045, 0.262 + k * 0.045, 't_steel', grp, M=M)
    rbox('cab_handle', (0.03, 0.03, 0.16), M @ T((0.45, 0.3, h * 0.55)), 't_chrome', grp, bevel=0.006); box('cab_plate', 0.435, 0.438, -0.2, 0.05, h - 0.5, h - 0.32, 't_yellow', grp, M=M)
    for k, e in enumerate(('t_ok', 't_ok', 't_warn')): lathe('cab_lamp', [(0, 0.014), (0.014, 0.012), (0.016, 0), (0, 0)], em=e, segs=10, closed=False, M=M @ T((0.435, -0.2 + k * 0.07, h - 0.18), (0, pi / 2, 0)))
    for y in (-0.2, 0.0, 0.2): rod('cab_conduit', (0.2, y, h), (0.2, y, h + rise), 0.022, 't_steel', grp, M=M); lathe('cab_gland', [(0, 0.05), (0.03, 0.05), (0.034, 0), (0, 0)], 't_chrome', grp, segs=10, closed=False, M=M @ T((0.2, y, h)))

def a_drum(M=I4, grp='props', m='t_paint'):
    lathe('drum', [(0, 0.88), (0.26, 0.88), (0.29, 0.86), (0.29, 0.6), (0.3, 0.59), (0.3, 0.56), (0.29, 0.55), (0.29, 0.31), (0.3, 0.3), (0.3, 0.27), (0.29, 0.26), (0.29, 0.02), (0.27, 0), (0, 0)], m, grp, segs=28, closed=False, M=M)
    lathe('drum_bung', [(0, 0.03), (0.025, 0.03), (0.03, 0), (0, 0)], 't_chrome', grp, segs=10, closed=False, M=M @ T((0.15, 0.05, 0.88)))
def a_pallet(M=I4, grp='props'):
    """A pallet with a strapped load: two crates and a drum."""
    for y in (-0.5, 0, 0.5): box('pallet_run', -0.6, 0.6, y - 0.05, y + 0.05, 0, 0.1, 'crate_w', grp, M=M)
    for x in (-0.5, -0.25, 0, 0.25, 0.5): box('pallet_board', x - 0.06, x + 0.06, -0.6, 0.6, 0.1, 0.125, 'crate_w', grp, M=M)
    box('pallet_crate', -0.55, 0.05, -0.55, 0.15, 0.125, 0.85, 't_light', grp, bevel=0.02, M=M); box('pallet_crate2', -0.5, 0.0, -0.5, 0.1, 0.85, 1.35, 't_orange', grp, bevel=0.02, M=M)
    for y in (-0.4, 0.0): box('pallet_strap', -0.56, 0.06, y - 0.02, y + 0.02, 0.12, 1.36, 't_black', grp, M=M)
    a_drum(M @ T((0.3, 0.3, 0.125)), grp, 't_yellow'); box('pallet_label', 0.05, 0.053, -0.4, -0.1, 0.4, 0.6, 't_label', grp, M=M)

def a_extinguisher(M=I4, grp='props'):
    """A fire extinguisher on a wall bracket at x = 0 (facing +x), under its sign."""
    lathe('ext', [(0, 0.5), (0.03, 0.5), (0.035, 0.46), (0.075, 0.42), (0.08, 0.02), (0.07, 0), (0, 0)], 't_red', grp, segs=18, closed=False, M=M @ T((0.1, 0, 0.5)))
    lathe('ext_valve', [(0, 0.08), (0.02, 0.08), (0.025, 0), (0, 0)], 't_chrome', grp, segs=10, closed=False, M=M @ T((0.1, 0, 1.0))); rod('ext_hose', (0.1, 0.03, 1.04), (0.14, 0.09, 0.7), 0.01, 't_black', grp, M=M)
    rbox('ext_lever', (0.1, 0.025, 0.012), M @ T((0.13, 0, 1.09), (0, -0.3, 0)), 't_black', grp); box('ext_bracket', 0, 0.03, -0.09, 0.09, 0.55, 0.62, 't_steel', grp, M=M); box('ext_sign', 0, 0.006, -0.11, 0.11, 1.35, 1.6, 't_red', grp, M=M); box('ext_sign2', 0.006, 0.008, -0.06, 0.06, 1.4, 1.55, 't_label', grp, M=M)

def a_stanchion(M=I4, grp='props', L=2.0):
    """Two barrier posts and the belt between them (along y)."""
    for y in (0, L):
        lathe('post', [(0, 0.96), (0.03, 0.96), (0.035, 0.9), (0.025, 0.88), (0.025, 0.04), (0.16, 0.02), (0.17, 0), (0, 0)], 't_chrome', grp, segs=20, closed=False, M=M @ T((0, y, 0)))
    box('belt', -0.003, 0.003, 0.03, L - 0.03, 0.84, 0.9, 't_seat', grp, M=M)

def a_grille(M=I4, grp='props', w=1.2, h=0.6):
    """A ventilation grille on a wall at x = 0: frame, louvres, four fixings."""
    box('grille_frame', 0, 0.03, -w / 2, w / 2, -h / 2, h / 2, 't_steel', grp, bevel=0.006, M=M); box('grille_dark', 0.03, 0.032, -w / 2 + 0.05, w / 2 - 0.05, -h / 2 + 0.05, h / 2 - 0.05, 't_black', grp, M=M)
    n = int(h / 0.06)
    for k in range(n): rbox('grille_slat', (0.03, w - 0.1, 0.008), M @ T((0.04, 0, -h / 2 + 0.07 + k * (h - 0.14) / max(1, n - 1)), (0, 0.6, 0)), 't_paint', grp)
    _bolts(M, grp, [(0.03, sy * (w / 2 - 0.025), sz * (h / 2 - 0.025)) for sy in (-1, 1) for sz in (-1, 1)])

def a_duct(M=I4, grp='archC', L=6.0):
    """A ceiling duct along y: rectangular run with flanged joints, hangers, a round diffuser every other bay."""
    box('duct', -0.3, 0.3, 0, L, -0.4, 0, 't_light', grp, M=M)
    n = int(L / 1.5)
    for k in range(n + 1):
        y = k * L / n; box('duct_flange', -0.33, 0.33, y - 0.02, y + 0.02, -0.43, 0.03, 't_steel', grp, M=M)
        for x in (-0.36, 0.36): rod('duct_hanger', (x, y, -0.43), (x, y, 0.5), 0.006, 't_steel', grp, M=M)
        if k % 2 and k < n: lathe('duct_diffuser', [(0, -0.06), (0.1, -0.06), (0.2, -0.02), (0.24, 0), (0, 0)], 't_paint', grp, segs=24, closed=False, M=M @ T((0, y + L / n / 2, -0.4)))

def a_console(M=I4, grp='props', w=1.6):
    """An operator's console facing +x: pedestal, a sloped desk of key rows and switches, two lit status strips, a hooded display."""
    box('con_ped', -0.28, 0.1, -w / 2 + 0.06, w / 2 - 0.06, 0, 0.7, 't_paint', grp, bevel=0.012, M=M); box('con_kick', -0.26, 0.12, -w / 2 + 0.1, w / 2 - 0.1, 0, 0.1, 't_black', grp, M=M)
    D = M @ T((0.0, 0, 0.78), (0, 0.32, 0))
    rbox('con_desk', (0.62, w, 0.07), D, 't_steel', grp, bevel=0.012)
    for r in range(3):
        for c in range(int(w / 0.085) - 2): rbox('con_key', (0.05, 0.06, 0.016), D @ T((0.16 - r * 0.075, -w / 2 + 0.13 + c * 0.085, 0.043)), 't_light' if (r + c) % 5 else 't_orange', grp, bevel=0.004)
    for c in range(6): lathe('con_switch', [(0, 0.03), (0.006, 0.03), (0.008, 0.008), (0.014, 0.006), (0.014, 0), (0, 0)], 't_chrome', grp, segs=8, closed=False, M=D @ T((-0.12, -w / 2 + 0.16 + c * 0.07, 0.035)))
    rbox('con_strip', (0.012, w * 0.4, 0.004), D @ T((-0.2, w * 0.2, 0.037)), None, None, em='t_cy'); rbox('con_strip2', (0.012, w * 0.2, 0.004), D @ T((-0.2, -w * 0.3, 0.037)), None, None, em='t_warn')
    rbox('con_hood', (0.1, w * 0.7, 0.34), M @ T((-0.3, 0, 1.08), (0, -0.25, 0)), 't_paint', grp, bevel=0.015); rbox('con_glass', (0.006, w * 0.62, 0.26), M @ T((-0.245, 0, 1.085), (0, -0.25, 0)), 't_glass', grp)
    rbox('con_glow', (0.004, w * 0.5, 0.012), M @ T((-0.24, 0, 0.98), (0, -0.25, 0)), None, None, em='t_cy')

def a_opchair(M=I4, grp='props'):
    """An operator's chair facing +x on a five-star base."""
    for a in range(5):
        ang = a * 2 * pi / 5; rod('opc_leg', (0, 0, 0.1), (0.3 * math.cos(ang), 0.3 * math.sin(ang), 0.05), 0.016, 't_chrome', grp, M=M); blob('opc_wheel', M @ Vector((0.3 * math.cos(ang), 0.3 * math.sin(ang), 0.03)), 0.03, 't_rubber', grp)
    rod('opc_post', (0, 0, 0.08), (0, 0, 0.44), 0.025, 't_chrome', grp, M=M)
    rbox('opc_seat', (0.46, 0.48, 0.09), M @ T((0.02, 0, 0.49)), 't_seat', grp, bevel=0.035, seg=3); rbox('opc_back', (0.08, 0.44, 0.52), M @ T((-0.22, 0, 0.82), (0, -0.14, 0)), 't_seat', grp, bevel=0.035, seg=3)
    rbox('opc_head', (0.07, 0.26, 0.16), M @ T((-0.27, 0, 1.18), (0, -0.14, 0)), 't_seat', grp, bevel=0.03, seg=3)
    for d in (-1, 1): rod('opc_arm', (-0.18, d * 0.27, 0.5), (-0.18, d * 0.27, 0.7), 0.012, 't_chrome', grp, M=M); rbox('opc_pad', (0.28, 0.06, 0.03), M @ T((-0.05, d * 0.27, 0.71)), 't_black', grp, bevel=0.01)

def a_kiosk(M=I4, grp='props'):
    """A wayfinding pylon (faces +x): a tall slab with a lit header, a dark glass face, a ring of light at its foot."""
    box('kiosk_foot', -0.22, 0.22, -0.4, 0.4, 0, 0.06, 't_steel', grp, bevel=0.012, M=M); box('kiosk_body', -0.09, 0.09, -0.34, 0.34, 0.06, 2.3, 't_paint', grp, bevel=0.02, M=M)
    box('kiosk_glass', 0.09, 0.096, -0.3, 0.3, 0.7, 1.9, 't_glass', grp, M=M); box('kiosk_head', 0.09, 0.098, -0.3, 0.3, 2.0, 2.2, None, None, em='t_cy', M=M)
    box('kiosk_base_glow', -0.2, 0.2, -0.38, 0.38, 0.06, 0.07, None, None, em='t_cy', M=M)
    for k in range(4): box('kiosk_row', 0.096, 0.098, -0.24, 0.1 + 0.03 * k, 1.7 - k * 0.2, 1.74 - k * 0.2, None, None, em='t_warn' if k == 0 else 't_cy', M=M)

def a_bench_hall(M=I4, grp='props', L=2.4):
    """A concourse bench along y: a slab seat on two steel blades, a low back rail, a light under the seat."""
    box('hb_seat', -0.26, 0.26, 0, L, 0.4, 0.47, 't_light', grp, bevel=0.02, seg=3, M=M); box('hb_pad', -0.22, 0.22, 0.06, L - 0.06, 0.47, 0.5, 't_seat', grp, bevel=0.012, M=M)
    for y in (0.3, L - 0.3): box('hb_leg', -0.2, 0.2, y - 0.03, y + 0.03, 0, 0.4, 't_steel', grp, bevel=0.006, M=M)
    rod('hb_rail', (-0.24, 0.1, 0.78), (-0.24, L - 0.1, 0.78), 0.02, 't_chrome', grp, M=M)
    for y in (0.3, L - 0.3): rod('hb_post', (-0.24, y, 0.47), (-0.24, y, 0.78), 0.012, 't_chrome', grp, M=M)
    box('hb_glow', -0.2, 0.2, 0.4, L - 0.4, 0.385, 0.395, None, None, em='t_work', M=M)

def a_luggage(M=I4, grp='props'):
    """A luggage trolley with three cases, as left by someone boarding."""
    _castors(M, grp, ((-0.3, -0.22), (-0.3, 0.22), (0.3, -0.22), (0.3, 0.22)), 0.035)
    box('lug_deck', -0.36, 0.36, -0.26, 0.26, 0.09, 0.12, 't_steel', grp, bevel=0.006, M=M)
    for y in (-0.24, 0.24): rod('lug_handle', (-0.36, y, 0.12), (-0.42, y, 0.95), 0.012, 't_chrome', grp, M=M)
    rod('lug_bar', (-0.42, -0.24, 0.95), (-0.42, 0.24, 0.95), 0.014, 't_chrome', grp, M=M)
    for (x, y, z, sx_, sy_, sz_, m) in ((0.02, 0, 0.12, 0.6, 0.44, 0.24, 't_orange'), (0.0, -0.02, 0.36, 0.52, 0.36, 0.2, 't_light'), (0.06, 0.03, 0.56, 0.36, 0.28, 0.16, 't_seat')):
        rbox('lug_case', (sx_, sy_, sz_), M @ T((x, y, z + sz_ / 2), (0, 0, random.uniform(-0.1, 0.1))), m, grp, bevel=0.03, seg=3); rbox('lug_band', (sx_ + 0.004, 0.03, sz_ + 0.004), M @ T((x, y, z + sz_ / 2)), 't_black', grp)

def a_stepladder(M=I4, grp='props'):
    for d in (-1, 1):
        rod('sl_front', (0.35, d * 0.22, 0), (0, d * 0.17, 1.5), 0.018, 't_yellow', grp, M=M); rod('sl_back', (-0.45, d * 0.2, 0), (0, d * 0.17, 1.5), 0.014, 't_steel', grp, M=M)
    for k in range(1, 5):
        t = k / 5; rbox('sl_step', (0.09, 0.42 - 0.08 * t, 0.02), M @ T((0.35 * (1 - t), 0, 1.5 * t)), 't_steel', grp)
    rbox('sl_top', (0.2, 0.36, 0.03), M @ T((0, 0, 1.5)), 't_yellow', grp, bevel=0.006)

def a_floorhatch(M=I4, grp='center', w=1.2):
    """A deck hatch: a chequer plate in a hazard-striped frame with two recessed handles."""
    box('hatch', -w / 2, w / 2, -w / 2, w / 2, 0, 0.006, 't_steel', grp, M=M)
    for k in range(int(w / 0.15)):
        m = 't_yellow' if k % 2 else 't_black'; a, b = -w / 2 + k * 0.15, -w / 2 + (k + 1) * 0.15
        for s_ in (-1, 1): box('hatch_haz', a, b, s_ * (w / 2), s_ * (w / 2 + 0.06), 0, 0.004, m, grp, M=M); box('hatch_haz', s_ * (w / 2), s_ * (w / 2 + 0.06), a, b, 0, 0.004, m, grp, M=M)
    for y in (-w * 0.3, w * 0.3): box('hatch_grip', -0.08, 0.08, y - 0.02, y + 0.02, 0.006, 0.009, 't_black', grp, M=M)
    _bolts(M, grp, [(sx_ * (w / 2 - 0.05), sy_ * (w / 2 - 0.05), 0.006) for sx_ in (-1, 1) for sy_ in (-1, 1)], 0.012)

def a_pegboard(M=I4, grp='props', w=2.0):
    """A tool board on a wall at x = 0: outlines filled with spanners, a saw, a square, reels of wire."""
    box('peg', 0, 0.02, -w / 2, w / 2, 0, 1.0, 't_light', grp, M=M)
    for k in range(7): rod('peg_spanner', (0.03, -w / 2 + 0.15 + k * 0.11, 0.55), (0.03, -w / 2 + 0.15 + k * 0.11, 0.55 + 0.16 + k * 0.03), 0.008, 't_chrome', grp, M=M)
    box('peg_square', 0.02, 0.028, 0.1, 0.5, 0.15, 0.19, 't_steel', grp, M=M); box('peg_square2', 0.02, 0.028, 0.1, 0.14, 0.15, 0.6, 't_steel', grp, M=M)
    for k in range(3): torus('peg_reel', 0.07, 0.025, M @ T((0.05, w / 2 - 0.2 - k * 0.22, 0.75), (0, pi / 2, 0)), ('t_orange', 't_red', 't_black')[k], grp, segs=20)
    rbox('peg_drill', (0.07, 0.22, 0.07), M @ T((0.06, w / 2 - 0.45, 0.3)), 't_orange', grp, bevel=0.02); rbox('peg_drillgrip', (0.05, 0.05, 0.14), M @ T((0.06, w / 2 - 0.38, 0.2)), 't_black', grp, bevel=0.015)

TECH = dict(toolchest=a_toolchest, cabinet=a_cabinet, drum=a_drum, pallet=a_pallet, extinguisher=a_extinguisher, stanchion=a_stanchion, grille=a_grille, duct=a_duct,
            console=a_console, opchair=a_opchair, kiosk=a_kiosk, bench_hall=a_bench_hall, luggage=a_luggage, stepladder=a_stepladder, floorhatch=a_floorhatch, pegboard=a_pegboard)
