"""Reproducible Blender/Cycles scene for the portfolio's exploratory landscape.
Run: blender -b --python scripts/artwork/render-horizon.py -- --preview
The NASA/JPL rover is illustrative; see assets/scenes/models/README.md for attribution.
"""
import argparse
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Vector, noise

args = argparse.ArgumentParser()
args.add_argument('--preview', action='store_true')
args.add_argument('--output', default='/tmp/portfolio-artwork')
args = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
root = Path(__file__).resolve().parents[2]
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
random.seed(61)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24 if args.preview else 96
scene.cycles.use_denoising = True
scene.cycles.adaptive_threshold = .04 if args.preview else .015
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 3
scene.cycles.transparent_max_bounces = 4
scene.render.threads_mode = 'FIXED'
scene.render.threads = 6
scene.render.resolution_x = 1200 if args.preview else 2400
scene.render.resolution_y = 675 if args.preview else 1350
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .3

# Material helpers keep weathering in world units rather than image overlays.
def material(name, color, roughness=1, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    return mat

def stone(name, dark, light, grain=95):
    mat = material(name, dark)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    p = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 3.7
    tex.inputs['Detail'].default_value = 5
    tex.inputs['Roughness'].default_value = .8
    coord = nodes.new('ShaderNodeTexCoord')
    links.new(coord.outputs['Object'], tex.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .16
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = .85
    ramp.color_ramp.elements[1].color = (*light, 1)
    links.new(tex.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs[0], p.inputs['Base Color'])
    fine = nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = grain
    fine.inputs['Detail'].default_value = 3
    links.new(coord.outputs['Object'], fine.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .7
    bump.inputs['Distance'].default_value = .035
    links.new(fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return mat

regolith = stone('Ochre dust / basalt fragments', (.055,.024,.015), (.29,.14,.069), 125)
basalt = stone('Weathered layered basalt', (.025,.021,.019), (.16,.094,.055), 75)

for mat in [regolith,basalt]:
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    p=nodes.get('Principled BSDF')
    coord=nodes.new('ShaderNodeTexCoord')
    mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=.35
    links.new(coord.outputs['Object'],mapping.inputs[0])
    tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(root/'assets/scenes/textures/rock-color.jpg'));tex.projection='BOX';tex.projection_blend=.25
    links.new(mapping.outputs[0],tex.inputs['Vector'])
    tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=.7;tint.inputs[2].default_value=(.52,.27,.13,1)
    links.new(tex.outputs['Color'],tint.inputs[1]);links.new(tint.outputs[0],p.inputs['Base Color'])
    height=nodes.new('ShaderNodeTexImage');height.image=bpy.data.images.load(str(root/'assets/scenes/textures/rock-height.jpg'));height.image.colorspace_settings.name='Non-Color';height.projection='BOX';height.projection_blend=.25
    links.new(mapping.outputs[0],height.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.8;bump.inputs['Distance'].default_value=.16
    links.new(height.outputs['Color'],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])

# A near ridge gives the wheels a definite contact plane. Beyond it: eroded relief.
def ground_height(x,y):
    distance = math.hypot(x-2,y)
    local = noise.fractal(Vector((x*.36,y*.36,3.1)),1.0,2.15,4)*.22
    ridge = noise.ridged_multi_fractal(Vector((x*.065,y*.065,1.4)),1.0,2.0,5,1,2)
    base = -.65 + ridge*.85 + local
    if y > 8:
        base -= min(6,(y-8)*.12)
    blend=min(1,max(0,(distance-3)/8))
    blend=blend*blend*(3-2*blend)
    return base*blend

def terrain(name, x1,x2,y1,y2,nx,ny,height):
    vertices=[]
    for j in range(ny+1):
        y=y1+(y2-y1)*j/ny
        for i in range(nx+1):
            x=x1+(x2-x1)*i/nx
            vertices.append((x,y,height(x,y)))
    faces=[]
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i
            faces.append((a,a+1,a+nx+2,a+nx+1))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(regolith)
    for p in mesh.polygons:p.use_smooth=True
    return obj

terrain('Foreground ridge',-65,65,-40,95,230,235,ground_height)
for layer in range(4):
    center=90+layer*105
    def mountain(x,y,layer=layer,center=center):
        n=noise.ridged_multi_fractal(Vector((x*.021,y*.023,4+layer)),.95,2.0,5,1,2)
        envelope=math.exp(-((y-center)/(25+layer*11))**2)
        return -6+(n*4.2+2+layer*2)*envelope
    terrain('Distant escarpment %d'%layer,-500,500,center-60,center+95,240,70,mountain)

# Reuse a small set of sculpted meshes across hundreds of fragments.
rock_meshes=[]
for i in range(9):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=1)
    obj=bpy.context.object
    obj.name='Basalt source %d'%i
    for v in obj.data.vertices:
        p=v.co.copy()
        f=.78+noise.noise_vector(p*2.8+Vector((i,4,8))).x*.27
        v.co.x*=f
        v.co.y*=f
        v.co.z*=f*.55
        v.co.z+=.08*math.sin(p.x*9+p.y*3)
    obj.data.materials.append(basalt)
    for p in obj.data.polygons:p.use_smooth=True
    rock_meshes.append(obj.data)
    bpy.data.objects.remove(obj,do_unlink=True)
for i in range(680):
    x=random.uniform(-25,28)
    y=random.uniform(-14,39)
    if (x-2)**2+y*y < 9:continue
    size=random.uniform(.035,.15) if i<480 else random.uniform(.18,.9)
    if i>660:size=random.uniform(.8,1.8)
    obj=bpy.data.objects.new('Basalt fragment',rock_meshes[i%9])
    scene.collection.objects.link(obj)
    obj.location=(x,y,ground_height(x,y)+size*.1)
    obj.rotation_euler=(random.uniform(-.18,.18),random.uniform(-.18,.18),random.uniform(0,math.tau))
    obj.scale=(size*random.uniform(.7,1.4),size, size)

# Import actual engineering geometry and apply only the mast's deployment channels.
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/scenes/models/nasa-perseverance.glb'))
rover_objects=set(bpy.data.objects)-before
for obj in rover_objects:
    if obj.animation_data:
        obj.animation_data.action=None
        for track in obj.animation_data.nla_tracks:
            track.mute=track.name not in ['CylinderAction','bottomAction','topAction','Cylinder.002Action']
            for strip in track.strips:strip.extrapolation='HOLD'
scene.frame_set(150)
bpy.context.view_layer.update()
# Neutral finish in place of agency identifiers on the illustrative portfolio image.
for mat in bpy.data.materials:
    if mat.name=='arm_graphics':
        p=mat.node_tree.nodes.get('Principled BSDF')
        for link in list(p.inputs['Base Color'].links):mat.node_tree.links.remove(link)
        p.inputs['Base Color'].default_value=(.46,.45,.40,1)
        p.inputs['Roughness'].default_value=.6
for obj in rover_objects:
    if obj.type=='MESH' and not len(obj.data.materials):obj.hide_render=True
# Parent using world-preserving transforms, then place wheel contact at z=0.
mount=bpy.data.objects.new('Perseverance / illustrative explorer',None)
scene.collection.objects.link(mount)
for obj in rover_objects:
    if obj.parent not in rover_objects:
        matrix=obj.matrix_world.copy()
        obj.parent=mount
        obj.matrix_world=matrix
bpy.context.view_layer.update()
points=[o.matrix_world@v.co for o in rover_objects if o.type=='MESH' and len(o.data.materials) and not all(m and m.name=='transparent' for m in o.data.materials) for v in o.data.vertices]
minimum=Vector(tuple(min(p[i] for p in points) for i in range(3)))
maximum=Vector(tuple(max(p[i] for p in points) for i in range(3)))
factor=4.4/max(maximum.x-minimum.x,maximum.y-minimum.y)
mount.scale=(factor,)*3
mount.location=(2-(maximum.x+minimum.x)*factor/2,-(maximum.y+minimum.y)*factor/2,-minimum.z*factor-.025)
bpy.context.view_layer.update()
print('ROVER BOUNDS',minimum[:],maximum[:],factor,flush=True)

# Directional dawn and a large soft sky source; contact shadows come from Cycles.
world=bpy.data.worlds.new('Thin, dark sky')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.11,.16,.21,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.22
wn=world.node_tree.nodes;wl=world.node_tree.links
path=wn.new('ShaderNodeLightPath');camera_bg=wn.new('ShaderNodeBackground');camera_bg.inputs['Color'].default_value=(.006,.009,.012,1);camera_bg.inputs['Strength'].default_value=.7
mix=wn.new('ShaderNodeMixShader');wl.new(path.outputs['Is Camera Ray'],mix.inputs[0]);wl.new(wn['Background'].outputs[0],mix.inputs[1]);wl.new(camera_bg.outputs[0],mix.inputs[2]);wl.new(mix.outputs[0],wn['World Output'].inputs['Surface'])
scene.world=world

def aim(obj, point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
def lamp(name,kind,location,energy,color,size=5,target=(2,0,1)):
    data=bpy.data.lights.new(name,kind)
    data.energy=energy
    data.color=color
    if kind=='AREA':data.shape='DISK';data.size=size
    if kind=='SUN':data.angle=.07
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    aim(obj,target)
    return obj
lamp('Low amber sun','SUN',(-40,65,17),3.2,(1,.62,.34))
lamp('Cool open sky','AREA',(3,-9,11),750,(.64,.78,1),10)
lamp('Warm horizon bounce','AREA',(-7,4,5),650,(1,.55,.29),8)

# Dust haze fades the distant ridges without obscuring the foreground model.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,200,45))
haze=bpy.context.object
haze.name='Distance haze'
haze.scale=(900,340,120)
mat=bpy.data.materials.new('Atmospheric dust');mat.use_nodes=True
n=mat.node_tree.nodes;n.clear()
volume=n.new('ShaderNodeVolumeScatter');volume.inputs['Color'].default_value=(.43,.29,.19,1);volume.inputs['Density'].default_value=.0025;volume.inputs['Anisotropy'].default_value=.25
pos=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');mat.node_tree.links.new(pos.outputs['Position'],sep.inputs[0])
mult=n.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=-.12;mat.node_tree.links.new(sep.outputs['Z'],mult.inputs[0])
exp=n.new('ShaderNodeMath');exp.operation='EXPONENT';mat.node_tree.links.new(mult.outputs[0],exp.inputs[0])
density=n.new('ShaderNodeMath');density.operation='MULTIPLY';density.inputs[1].default_value=.0035;mat.node_tree.links.new(exp.outputs[0],density.inputs[0]);mat.node_tree.links.new(density.outputs[0],volume.inputs['Density'])
output=n.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(volume.outputs['Volume'],output.inputs['Volume']);haze.data.materials.append(mat)

bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.42,location=(-48,120,5.3))
sun_disc=bpy.context.object;sun_disc.name='Sun at the horizon'
sun_mat=bpy.data.materials.new('Sun emission');sun_mat.use_nodes=True
sn=sun_mat.node_tree.nodes;sn.clear();se=sn.new('ShaderNodeEmission');se.inputs[0].default_value=(1,.68,.32,1);se.inputs[1].default_value=24
so=sn.new('ShaderNodeOutputMaterial');sun_mat.node_tree.links.new(se.outputs[0],so.inputs['Surface']);sun_disc.data.materials.append(sun_mat)

# Sparse physical star discs. Their locations remain deterministic.
star_mat=bpy.data.materials.new('Starlight');star_mat.use_nodes=True
n=star_mat.node_tree.nodes;n.clear();em=n.new('ShaderNodeEmission');em.inputs[0].default_value=(.63,.73,.85,1);em.inputs[1].default_value=1.5
op=n.new('ShaderNodeOutputMaterial');star_mat.node_tree.links.new(em.outputs[0],op.inputs['Surface'])
for i in range(100):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(.025,.07),location=(random.uniform(-180,180),430,random.uniform(40,230)))
    bpy.context.object.data.materials.append(star_mat)

camera_data=bpy.data.cameras.new('Homepage composition')
camera=bpy.data.objects.new('Homepage composition',camera_data);scene.collection.objects.link(camera)
camera.location=(8,-12,3.8)
aim(camera,(-5.5,5,2.0))
camera_data.lens=36
camera_data.clip_end=1200
scene.camera=camera
bpy.context.view_layer.update()
def framed_position(u,v,distance):
    q=camera.rotation_euler.to_quaternion()
    half_width=distance*.5
    half_height=half_width/(16/9)
    return camera.location+q@Vector(((u-.5)*2*half_width,(v-.5)*2*half_height,-distance))
sun_disc.location=framed_position(.60,.70,150)
sunlight=bpy.data.objects['Low amber sun'];sunlight.location=sun_disc.location;aim(sunlight,(2,0,0))
sunlight.data.energy=2.2

scene.render.film_transparent=False
scene.use_nodes=True
nodes=scene.node_tree.nodes;nodes.clear()
rl=nodes.new('CompositorNodeRLayers')
glare=nodes.new('CompositorNodeGlare');glare.glare_type='FOG_GLOW';glare.threshold=2;glare.quality='HIGH'
comp=nodes.new('CompositorNodeComposite');scene.node_tree.links.new(rl.outputs['Image'],glare.inputs['Image']);scene.node_tree.links.new(glare.outputs['Image'],comp.inputs['Image'])
scene.view_layers[0].use_pass_mist=True
world.mist_settings.start=5;world.mist_settings.depth=110;world.mist_settings.falloff='LINEAR'
depth_output=nodes.new('CompositorNodeOutputFile');depth_output.base_path=str(out);depth_output.file_slots[0].path='horizon-depth-';depth_output.format.file_format='PNG';depth_output.format.color_mode='BW';depth_output.format.color_depth='8'
scene.node_tree.links.new(rl.outputs['Mist'],depth_output.inputs[0])
scene.render.filepath=str(out/('horizon-preview.png' if args.preview else 'horizon.png'))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'horizon.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('RENDER_COMPLETE',scene.render.filepath,flush=True)
