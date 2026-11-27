# List of every surface along the sun ray from given points
import bpy, sys
from mathutils import Vector
s = bpy.context.scene; deps = bpy.context.evaluated_depsgraph_get()
d = next((o.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized() for o in s.objects if o.type == 'LIGHT' and o.data.type == 'SUN')
for p in sys.argv[sys.argv.index('--') + 1:]:
    o = Vector(map(float, p.split(','))) + d * 1e-3; hits = []
    for _ in range(40):
        hit, loc, _, _, obj, _ = s.ray_cast(deps, o, d, distance=5000)
        if not hit: break
        hits.append(f'{obj.name}@{(loc - Vector(map(float, p.split(",")))).length:.1f}m{"" if obj.visible_shadow else "(no shadow)"}{"(hidden)" if obj.hide_render else ""}[{obj.users_collection[0].name}]')
        o = loc + d * 1e-3
    print('HITS', p, ' -> '.join(hits) or 'clear', flush=True)
