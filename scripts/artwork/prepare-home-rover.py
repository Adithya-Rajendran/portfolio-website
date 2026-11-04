"""Bake the posed NASA/JPL rover into a compact, static browser asset.

Run with Blender: blender -b --python scripts/artwork/prepare-home-rover.py
The source scene and model attribution live under assets/scenes/.
"""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root / 'assets/scenes/horizon.blend'))
bpy.context.scene.frame_set(150)
bpy.context.view_layer.update()
mount = bpy.data.objects['Perseverance / illustrative explorer']
depsgraph = bpy.context.evaluated_depsgraph_get()
baked = []
for obj in list(mount.children_recursive):
    if obj.type != 'MESH' or obj.hide_render or not obj.data.materials:
        continue
    if all(mat.name == 'transparent' for mat in obj.data.materials):
        continue
    evaluated = obj.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    mesh.transform(obj.matrix_world)
    part = bpy.data.objects.new('Explorer / ' + obj.name, mesh)
    bpy.context.collection.objects.link(part)
    baked.append(part)

# A single object lets glTF combine disconnected parts sharing a material.
bpy.ops.object.select_all(action='DESELECT')
for obj in baked:
    obj.select_set(True)
bpy.context.view_layer.objects.active = baked[0]
bpy.ops.object.join()
rover = bpy.context.object
rover.name = 'Perseverance / NASA JPL-Caltech / illustrative explorer'
output = root / 'public/models/home-rover-v1.glb'
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format='GLB',
    use_selection=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_image_format='JPEG',
    export_jpeg_quality=85,
)
print('HOME_ROVER_READY', output.stat().st_size, flush=True)
