"""Which objects block the sun at given points? Ray-casts the built scene toward the authored sun direction.
  blender -b lobby.blend -P sun_rays.py -- x0 x1 y0 y1 z nx ny      (Blender metres; a grid of nx*ny points at height z)
Prints a character map (. lit, letter = first blocking object) and the legend. Ignores objects hidden from render.
"""
import bpy, sys
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
x0, x1, y0, y1, z = map(float, a[:5]); nx, ny = int(a[5]), int(a[6])
s = bpy.context.scene; deps = bpy.context.evaluated_depsgraph_get()
sun = next(o for o in s.objects if o.type == 'LIGHT' and o.data.type == 'SUN')
d = (sun.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()   # toward the sun
print('SUN direction', tuple(round(c, 4) for c in d), 'elevation %.2f deg' % (__import__('math').degrees(__import__('math').asin(d.z))))
names, rows = {}, []
for j in range(ny):
    y = y1 - (y1 - y0) * j / (ny - 1); row = ''
    for i in range(nx):
        x = x0 + (x1 - x0) * i / (nx - 1); o = Vector((x, y, z)) + d * 1e-3; ch = '.'
        for _ in range(16):
            hit, loc, _, _, obj, _ = s.ray_cast(deps, o, d, distance=200)
            if not hit: break
            if obj.hide_render or 'fx' in obj or (obj.users_collection and obj.users_collection[0].name == 'Outside'): o = loc + d * 1e-3; continue
            key = obj.name.split('.')[0]; names.setdefault(key, chr(65 + len(names) % 26) if len(names) < 26 else chr(97 + (len(names) - 26) % 26)); ch = names[key]; break
        row += ch
    rows.append(f'y={y:6.2f} {row}')
print('\n'.join(rows)); print('LEGEND', {v: k for k, v in names.items()})
