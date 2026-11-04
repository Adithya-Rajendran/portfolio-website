"""Original mechanical still-life studies, modeled and rendered in Blender.
No external geometry or textures. Run blender -b --python this_file.py.
"""
import bpy, math, random
from mathutils import Vector
from pathlib import Path
out=Path('/tmp/portfolio-artwork');out.mkdir(exist_ok=True)
random.seed(31)

def material(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m

def aim(o,t):o.rotation_euler=(Vector(t)-o.location).to_track_quat('-Z','Y').to_euler()
def box(name,location,size,mat,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat)
 if bevel:
  b=o.modifiers.new('Machined edges','BEVEL');b.width=bevel;b.segments=3
  o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def cylinder(name,a,b,r,mat,vertices=64):
 delta=Vector(b)-Vector(a);center=(Vector(a)+Vector(b))/2
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=delta.length,location=center)
 o=bpy.context.object;o.name=name;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat)
 bevel=o.modifiers.new('Edge radius','BEVEL');bevel.width=.009;bevel.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def light(name,pos,power,color,size,target):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
 o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.location=pos;aim(o,target)

def setup():
 bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True;s.cycles.max_bounces=5;s.render.threads_mode='FIXED';s.render.threads=6
 s.render.resolution_x=1200;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast'
 w=bpy.data.worlds.new('Charcoal studio');w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.025,.045,.05,1);w.node_tree.nodes['Background'].inputs[1].default_value=.35;s.world=w
 mats={'ceramic':material('Warm ceramic',(.49,.46,.37),.35,.33),'green':material('Sage anodised aluminium',(.14,.23,.19),.6,.35),'dark':material('Charcoal alloy',(.026,.034,.035),.75,.3),'steel':material('Brushed titanium',(.31,.34,.34),.9,.24),'gold':material('Amber fasteners',(.55,.28,.07),.8,.28),'glass':material('Optical glass',(.012,.058,.065),.7,.08)}
 floor=material('Charcoal backdrop',(.012,.024,.025),.1,.7);box('Studio floor',(0,0,-.16),(200,200,.2),floor,0)
 d=bpy.data.cameras.new('Composition');c=bpy.data.objects.new('Composition',d);s.collection.objects.link(c);c.location=(4,-7,3.5);aim(c,(0,0,1.2));d.type='ORTHO';d.ortho_scale=5.2;s.camera=c
 light('Large amber softbox',(-3,1,5),700,(1,.68,.4),4,(0,0,1));light('Cool front',(2,-4,4),500,(.63,.83,1),3,(0,0,1));light('Sage rim',(1,3,3),800,(.55,.76,.63),2,(0,0,1))
 return s,mats

s,m=setup()
box('Mounting plate',(0,0,.07),(1.2,.8,.16),m['dark'])
for x in [-.47,.47]:
 for y in [-.27,.27]:cylinder('Hex bolt',(x,y,.14),(x,y,.19),.045,m['steel'],6)
cylinder('Azimuth bearing',(0,0,.15),(0,0,.4),.29,m['steel'])
cylinder('Servo body',(0,0,.34),(0,0,.85),.20,m['green'])
box('Lower arm',(0,0,1.08),(.30,.32,.58),m['ceramic'])
cylinder('Tilt bearing',(-.27,0,1.25),(.27,0,1.25),.22,m['dark'])
cylinder('Bearing cap',(-.30,0,1.25),(-.27,0,1.25),.15,m['gold'])
box('Sensor housing',(0,0,1.9),(2.6,.72,.85),m['green'],.10)
box('Camera face',(0,-.38,1.9),(2.52,.08,.78),m['ceramic'],.06)
for x in [-.7,.7]:
 cylinder('Lens barrel',(x,-.39,1.91),(x,-.57,1.91),.30,m['dark'])
 cylinder('Titanium lens rim',(x,-.54,1.91),(x,-.59,1.91),.27,m['steel'])
 cylinder('Lens inner barrel',(x,-.59,1.91),(x,-.61,1.91),.232,m['dark'])
 cylinder('Convex lens',(x,-.612,1.91),(x,-.625,1.91),.195,m['glass'])
 for i in range(32):
  a=i*math.tau/32
  cylinder('Knurl',(x+math.cos(a)*.283,-.44,1.91+math.sin(a)*.283),(x+math.cos(a)*.283,-.53,1.91+math.sin(a)*.283),.009,m['steel'],8)
for x in [-1.13,1.13]:
 for z in [1.63,2.17]:cylinder('Faceplate bolt',(x,-.43,z),(x,-.46,z),.026,m['dark'],6)
for i in range(12):box('Cooling fin',(1.315,.21-i*.04,1.9),(.04,.015,.5),m['dark'],.005)
# A braided service loop beneath the head, using a 3D bezier curve.
curve=bpy.data.curves.new('Service cable','CURVE');curve.dimensions='3D';curve.bevel_depth=.027;curve.bevel_resolution=3
sp=curve.splines.new('BEZIER');sp.bezier_points.add(3)
for p,co in zip(sp.bezier_points,[(.8,.2,1.55),(.8,.35,.9),(.35,.35,.65),(.1,.2,.7)]):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
o=bpy.data.objects.new('Service cable',curve);s.collection.objects.link(o);o.data.materials.append(m['dark'])
s.render.filepath=str(out/'optics-study.png');bpy.ops.wm.save_as_mainfile(filepath=str(out/'optics-study.blend'));bpy.ops.render.render(write_still=True)

s,m=setup();s.camera.location=(5,-7,4);aim(s.camera,(0,0,1.3));s.camera.data.ortho_scale=5.1
box('Base',(0,0,.08),(1.5,1.3,.16),m['dark'])
for x in [-.6,.6]:
 for y in [-.5,.5]:cylinder('Mounting bolt',(x,y,.15),(x,y,.21),.055,m['gold'],6)
cylinder('Mast',(0,0,.16),(0,0,1.6),.15,m['steel'])
# Curved parabolic reflector, not a flat icon.
verts=[];faces=[];N=96;R=22
for j in range(R+1):
 radius=j/R*1.25
 for i in range(N):
  a=i*math.tau/N;verts.append((radius*math.cos(a),radius*math.sin(a),radius*radius*.30))
for j in range(R):
 for i in range(N):
  a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
mesh=bpy.data.meshes.new('Parabolic reflector');mesh.from_pydata(verts,[],faces);mesh.update();dish=bpy.data.objects.new('Antenna reflector',mesh);s.collection.objects.link(dish);dish.data.materials.append(m['ceramic']);dish.location=(0,0,1.9);dish.rotation_euler=(math.radians(48),math.radians(-13),0)
for p in mesh.polygons:p.use_smooth=True
solid=dish.modifiers.new('Shell thickness','SOLIDIFY');solid.thickness=.022
# Parent the rim and feed supports in reflector coordinates.
bpy.ops.mesh.primitive_torus_add(major_radius=1.25,minor_radius=.026,major_segments=96,minor_segments=12)
rim=bpy.context.object;rim.parent=dish;rim.location=(0,0,1.25**2*.3);rim.data.materials.append(m['gold'])
for a in [0,math.tau/3,2*math.tau/3]:
 o=cylinder('Feed support',(1.2*math.cos(a),1.2*math.sin(a),.43),(0,0,1.05),.018,m['dark']);o.parent=dish
feed=cylinder('Receiver',(0,0,.92),(0,0,1.19),.11,m['green']);feed.parent=dish
for a in [0,math.pi/2,math.pi,3*math.pi/2]:
 o=cylinder('Structural rib',(0,0,-.03),(1.1*math.cos(a),1.1*math.sin(a),.34),.028,m['steel']);o.parent=dish
s.render.filepath=str(out/'signal-study.png');bpy.ops.wm.save_as_mainfile(filepath=str(out/'signal-study.blend'));bpy.ops.render.render(write_still=True)
print('STUDIES_COMPLETE',flush=True)
