# List of the objects that Cycles renders and that viewport tools can miss
import bpy
s = bpy.context.scene; vl = bpy.context.view_layer
for o in s.objects:
    if o.hide_render: continue
    flags = [k for k, v in (('hide_viewport', o.hide_viewport), ('hidden_in_view_layer', o.hide_get()), ('not_visible_in_vl', not o.visible_get())) if v]
    cols = [c.name for c in o.users_collection]
    if flags or any(c.hide_viewport for c in o.users_collection):
        print('RENDER-ONLY', o.name, o.type, flags, cols, tuple(round(v, 2) for v in o.matrix_world.translation), o.get('grp'), o.get('em'), o.get('fx'))
print('COLLECTIONS', [(c.name, c.hide_viewport, c.hide_render) for c in bpy.data.collections])
for lc in vl.layer_collection.children: print('LAYER', lc.name, 'exclude', lc.exclude, 'hide', lc.hide_viewport)
