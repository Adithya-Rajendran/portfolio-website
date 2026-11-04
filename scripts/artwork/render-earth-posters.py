"""Render the four progressive-loading / WebGL fallback Earths with Cycles.
Run prepare-orbit-assets.mjs first, then blender -b --python this-file.
The live, orbitable planet is implemented in src/scripts/planet-materials.ts.
"""
import math
from pathlib import Path
import tempfile
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
source = Path(tempfile.gettempdir()) / 'portfolio-orbit-sources'
out = Path(tempfile.gettempdir()) / 'portfolio-earth-posters'
out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'CUDA'
prefs.get_devices()
gpus = [d for d in prefs.devices if d.type == 'CUDA']
if not gpus:
    raise RuntimeError('CUDA GPU unavailable; no silent CPU render.')
for d in prefs.devices:
    d.use = d.type == 'CUDA'
scene.cycles.device = 'GPU'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles.transparent_max_bounces = 8
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.world = bpy.data.worlds.new('Gentle starlight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.14,.22,.38,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .10

def sphere(name, radius):
    # Match the live renderer's map orientation: Americas face the camera.
    vertices, faces, uvs = [], [], []
    nx, ny = 192, 128
    for j in range(ny+1):
        theta = j / ny * math.pi
        for i in range(nx+1):
            phi = i / nx * 2 * math.pi
            vertices.append((-radius*math.cos(phi)*math.sin(theta), -radius*math.sin(phi)*math.sin(theta), radius*math.cos(theta)))
            uvs.append((i/nx,1-j/ny))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i
            faces.append((a,a+nx+1,a+nx+2,a+1))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(vertices,[],faces); mesh.update()
    uv=mesh.uv_layers.new(name='Map')
    for face in mesh.polygons:
        face.use_smooth=True
        for li in face.loop_indices:
            uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
    obj.rotation_euler[1]=.14
    return obj

def image(nodes, path, data=False):
    tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(source/path),check_existing=True)
    if data: tex.image.colorspace_settings.name='Non-Color'
    return tex

earth=sphere('Earth / relief and city lights',1)
mat=bpy.data.materials.new('Surface');mat.use_nodes=True
n,l=mat.node_tree.nodes,mat.node_tree.links
p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=.8
day=image(n,'8k_earth_daymap.jpg');l.new(day.outputs['Color'],p.inputs['Base Color'])
normal=image(n,'2k_earth_normal_map.tif',True)
normal_node=n.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.3
l.new(normal.outputs['Color'],normal_node.inputs['Color']);l.new(normal_node.outputs[0],p.inputs['Normal'])
water=image(n,'2k_earth_specular_map.tif',True)
rough=n.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.87;rough.inputs['To Max'].default_value=.24
l.new(water.outputs['Color'],rough.inputs['Value']);l.new(rough.outputs[0],p.inputs['Roughness'])
night=image(n,'8k_earth_nightmap.jpg')
geo=n.new('ShaderNodeNewGeometry');dot=n.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';l.new(geo.outputs['Normal'],dot.inputs[0])
night_side=n.new('ShaderNodeMapRange');night_side.inputs['From Min'].default_value=-.2;night_side.inputs['From Max'].default_value=.12;night_side.inputs['To Min'].default_value=2.5;night_side.inputs['To Max'].default_value=0
l.new(dot.outputs['Value'],night_side.inputs[0]);l.new(night.outputs['Color'],p.inputs['Emission Color']);l.new(night_side.outputs[0],p.inputs['Emission Strength'])
earth.data.materials.append(mat)

cloud=sphere('Clouds / elevated shadow layer',1.008)
mat=bpy.data.materials.new('Cloud detail');mat.use_nodes=True
n,l=mat.node_tree.nodes,mat.node_tree.links;n.clear()
output=n.new('ShaderNodeOutputMaterial');white=n.new('ShaderNodeBsdfDiffuse');white.inputs['Color'].default_value=(.92,.96,1,1)
transparent=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader')
cloudmap=image(n,'8k_earth_clouds.jpg',True)
l.new(cloudmap.outputs['Color'],mix.inputs[0]);l.new(transparent.outputs[0],mix.inputs[1]);l.new(white.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],output.inputs['Surface'])
cloud.data.materials.append(mat)

shell=sphere('Atmospheric limb',1.018)
mat=bpy.data.materials.new('Thin blue scattering');mat.use_nodes=True
n,l=mat.node_tree.nodes,mat.node_tree.links;n.clear()
output=n.new('ShaderNodeOutputMaterial');transparent=n.new('ShaderNodeBsdfTransparent');emission=n.new('ShaderNodeEmission');emission.inputs['Color'].default_value=(.08,.30,.65,1);emission.inputs['Strength'].default_value=.32
facing=n.new('ShaderNodeLayerWeight');power=n.new('ShaderNodeMath');power.operation='POWER';power.inputs[1].default_value=5
l.new(facing.outputs['Facing'],power.inputs[0]);mix=n.new('ShaderNodeMixShader');l.new(power.outputs[0],mix.inputs[0]);l.new(transparent.outputs[0],mix.inputs[1]);l.new(emission.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],output.inputs['Surface']);shell.data.materials.append(mat)

bpy.ops.object.camera_add(location=(0,-3.65,.16));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=2.16;scene.camera=camera
bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.angle=.009
looks={
    'dawn':((-4,1.4,1.3),(1,.77,.52),2.5),
    'day':((3.5,2.4,4),(1,.95,.86),2.4),
    'dusk':((4,1.1,.65),(1,.68,.4),2.5),
    'night':((-3.5,1.2,-2.4),(.68,.81,1),2.2),
}
for name,(direction,color,energy) in looks.items():
    x,y,z=direction;v=Vector((x,-z,y)).normalized()
    sun.rotation_euler=(-v).to_track_quat('-Z','Y').to_euler()
    sun.data.color=color;sun.data.energy=energy
    dot.inputs[1].default_value=v
    scene.render.filepath=str(out/f'earth-{name}.png')
    print(f'Rendering {name} on {gpus[0].name}',flush=True)
    bpy.ops.render.render(write_still=True)
