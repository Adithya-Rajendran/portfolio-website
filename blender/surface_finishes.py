# Shared Cycles surface recipes, with geometry coordinates in metres
SURFACE_FAMILIES = {
    **dict.fromkeys(('wood', 'wood_l', 'wood_d'), 'timber'),
    **dict.fromkeys(('leather', 'leather_g', 't_seat'), 'hide'),
    **dict.fromkeys(('linen', 'sofa', 'runner', 'runner2', 'runner3', 'rug', 'rug2', 'drape'), 'cloth'),
    **dict.fromkeys(('t_paint', 't_orange', 't_yellow', 'yellow'), 'enamel'),
    **dict.fromkeys(('rubber', 't_rubber'), 'rubber'),
}


def apply_finish(g, shader, family, base, rough):
    pos = g.node('ShaderNodeNewGeometry').outputs['Position']
    def noise(stretch, frequency, detail=2, distortion=0):
        n = g.node('ShaderNodeTexNoise'); g._set(n.inputs['Vector'], g.vmath('MULTIPLY', pos, stretch))
        for key, value in [('Scale', frequency), ('Detail', detail), ('Distortion', distortion)]: g._set(n.inputs[key], value)
        return n.outputs['Fac']
    def existing(key, default):
        s = shader.inputs[key]; return s.links[0].from_socket if s.is_linked else default
    if family == 'timber':
        body = noise((5, .35, 3), 2.5, 3, .6); detail = noise((20, .75, 9), 6, 2, .22)
        shade = g.math('MULTIPLY', g.smooth(body,.25,.75,.63,1.18), g.smooth(detail,.28,.72,.68,1.1)); relief = .0005
    elif family == 'hide':
        v = g.node('ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE'); g._set(v.inputs['Vector'],pos); g._set(v.inputs['Scale'],220)
        detail = g.smooth(v.outputs['Distance'],.015,.20); body = noise((1,1,1),11,3)
        shade = g.math('MULTIPLY',g.smooth(body,.23,.78,.66,1.24),g.math('MULTIPLY_ADD',detail,.24,.76)); relief = .00085
    elif family == 'cloth':
        yarns=[]
        for axis in ('X','Y','Z'):
            w=g.node('ShaderNodeTexWave', bands_direction=axis); g._set(w.inputs['Vector'],pos); g._set(w.inputs['Scale'],115); g._set(w.inputs['Distortion'],1.2)
            yarns.append(w.outputs['Fac'])
        detail=g.math('MULTIPLY_ADD',g.math('ADD',g.math('ADD',yarns[0],yarns[1]),yarns[2]),1/3,0); body=noise((2,.55,1),12)
        shade=g.math('MULTIPLY',g.smooth(body,.24,.76,.79,1.14),g.math('MULTIPLY_ADD',detail,.32,.74)); relief=.00065
        shader.inputs['Sheen Weight'].default_value=.22
    else:
        detail=noise((1,1,1),190 if family=='rubber' else 380); body=noise((1,1,1),8,3)
        shade=g.smooth(body,.24,.76,.66 if family=='rubber' else .84,1.15); relief=.0007 if family=='rubber' else .00028
    color=existing('Base Color',base); rs=existing('Roughness',rough); normal=existing('Normal',None)
    g._set(shader.inputs['Base Color'],g.vmath('SCALE',color,scale=shade))
    g._set(shader.inputs['Roughness'],g.math('ADD',rs,g.math('MULTIPLY_ADD',body,.28,-.14),clamp=True))
    bump=g.node('ShaderNodeBump'); g._set(bump.inputs['Height'],detail); g._set(bump.inputs['Distance'],relief); g._set(bump.inputs['Strength'],.55); g._set(bump.inputs['Normal'],normal)
    g._set(shader.inputs['Normal'],bump.outputs['Normal'])
