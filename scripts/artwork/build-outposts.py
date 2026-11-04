"""Original lunar/Mars architectural studies. Export real geometry for Three.js.
NASA MSH and O'Neill/SSI references are documented in docs/v2-orbital-experience-design.md.
Run with Blender 4.5; --render also renders previews on a CUDA GPU.
"""
import bpy, math, random, sys
from mathutils import Vector, noise
from pathlib import Path

root=Path(__file__).resolve().parents[2]
output=root/'public/models';output.mkdir(exist_ok=True)
render='--render' in sys.argv

def mat(name,color,metal=0,rough=.65,glow=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if glow:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow
    return m
def finish(o,name,material):
    o.name=name;o.data.materials.append(material)
    return o
def box(name,loc,scale,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,material)
def cylinder(name,loc,radius,depth,material,rotation=(0,0,0),vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc,rotation=rotation)
    o=finish(bpy.context.object,name,material)
    for f in o.data.polygons:f.use_smooth=abs(f.normal.z)<.5
    return o
def sphere(name,loc,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc);o=bpy.context.object;o.scale=scale
    for f in o.data.polygons:f.use_smooth=True
    return finish(o,name,material)
def beam(name,a,b,r,material):
    d=Vector(b)-Vector(a);o=cylinder(name,(Vector(a)+Vector(b))/2,r,d.length,material,vertices=12)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def terrain(world):
    N=256;size=640
    def height(x,y):
        # Broad, continuously sloping landforms. The settled district is graded;
        # fine regolith belongs in the material, not in spiky mesh displacement.
        edge=math.sqrt(((x+16)/112)**2+((y-15)/112)**2)
        blend=max(0,min(1,(edge-.72)/.55));blend=blend*blend*(3-2*blend)
        base=noise.fractal(Vector((x*.009,y*.009,2)),1.1,2.1,2)*1.4
        ridge=9*(.65+.35*math.sin(x*.017+1))*math.exp(-((y-125)/40)**2)
        shoulder=4*math.exp(-((x+133)/42)**2-((y-15)/100)**2)
        return (base+ridge+shoulder)*blend
    verts=[(-size/2+i*size/N,-size/2+j*size/N,height(-size/2+i*size/N,-size/2+j*size/N)) for j in range(N+1) for i in range(N+1)]
    faces=[]
    for j in range(N):
        for i in range(N):
            a=j*(N+1)+i;faces.append((a,a+1,a+N+2,a+N+1))
    mesh=bpy.data.meshes.new('Sculpted terrain');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Regolith',mesh);bpy.context.scene.collection.objects.link(o)
    uv=mesh.uv_layers.new()
    for p in mesh.polygons:
        p.use_smooth=True
        for li in p.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x/9,v.y/9)
    ground=mat('Moon regolith' if world=='moon' else 'Mars regolith',(.34,.34,.35) if world=='moon' else (.28,.12,.055))
    n,l=ground.node_tree.nodes,ground.node_tree.links
    tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(root/f'assets/scenes/textures/{world}-ground-v2.jpg'),check_existing=True)
    l.new(tex.outputs['Color'],n.get('Principled BSDF').inputs['Base Color'])
    mesh.materials.append(ground)
    rock=mat('Basalt',(.17,.175,.18) if world=='moon' else (.19,.085,.035))
    for i in range(180):
        x=random.uniform(-140,140);y=random.uniform(-130,130)
        if abs(x)<65 and abs(y)<70:continue
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,height(x,y)))
        o=finish(bpy.context.object,'Weathered boulder',rock);s=random.uniform(.2,1.8);o.scale=(s,s*.7,s*.5);o.rotation_euler=(random.random(),random.random(),random.random())
        for p in o.data.polygons:p.use_smooth=True
    return height

def solar(x,y,rows=2,cols=4):
    for r in range(rows):
        for c in range(cols):
            px=x+c*8;py=y+r*8
            cylinder('Array mast',(px,py,1.1),.16,2.2,dark,vertices=12)
            panel=box('Photovoltaic wing',(px,py,2.3),(7,5.3,.12),blue)
            panel.rotation_euler[0]=.24
            for k in range(8):box('Cell separators',(px-3.4+k*.96,py,2.42),(.035,5.25,.025),metal)
            for k in [-2.5,0,2.5]:box('Array frame',(px,py+k,2.4),(7,.06,.05),metal)
def habitat(x,y,length=16):
    cylinder('Pressure shell',(x,y,4.6),3.2,length,white,(math.pi/2,0,0))
    for off in [-length/2,length/2]:
        sphere('Pressure endcap',(x,y+off,4.6),(3.2,.7,3.2),white)
        cylinder('Docking collar',(x,y+off*1.07,3.6),1.65,.5,dark,(math.pi/2,0,0))
        cylinder('Sealed hatch',(x,y+off*1.10,3.6),1.25,.55,metal,(math.pi/2,0,0))
    for off in range(-int(length/2)+1,int(length/2),3):
        bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,location=(x,y+off,4.6),rotation=(math.pi/2,0,0),major_radius=3.24,minor_radius=.1)
        finish(bpy.context.object,'Structural ribs',metal)
    for side in [-1,1]:
        box('Thermal service skirt',(x+side*3,y,3.5),(.3,length*.9,1.2),white,.1)
        box('Observation glazing',(x+side*3.18,y,5.4),(.12,length*.55,.65),glass,.06)
        box('Habitat running light',(x+side*3.2,y,4.8),(.08,length*.66,.07),warm)
        for off in [-length*.34,length*.34]:beam('Landing strut',(x+side*2,y+off,2.5),(x+side*4,y+off,0),.21,metal)
    box('Radiator roof',(x,y,7.9),(3.3,length*.7,.2),dark)
def dish(x,y,z=9):
    cylinder('Comms mast',(x,y,z/2),.35,z,white)
    # Open paraboloid, with the feed and three real support struts.
    vertices=[];faces=[];rings=10;sectors=32
    for j in range(rings+1):
        r=3.6*j/rings
        for i in range(sectors):
            a=i/sectors*2*math.pi;vertices.append((x+r*math.cos(a),y+r*math.sin(a),z+r*r*.09))
    for j in range(rings):
        for i in range(sectors):a=j*sectors+i;b=j*sectors+(i+1)%sectors;faces.append((a,b,b+sectors,a+sectors))
    mesh=bpy.data.meshes.new('Reflector');mesh.from_pydata(vertices,[],faces);mesh.materials.append(white);o=bpy.data.objects.new('Parabolic reflector',mesh);bpy.context.scene.collection.objects.link(o)
    for a in [0,2.094,4.189]:beam('Feed strut',(x+3.1*math.cos(a),y+3.1*math.sin(a),z+.86),(x,y,z+3.3),.07,metal)
    cylinder('Antenna feed',(x,y,z+3.2),.3,.7,gold)
def rover(x,y):
    box('Pressurized rover',(x,y,2.4),(4.2,6.7,2.7),white,.6)
    box('Rover windshield',(x,y-3.4,2.8),(3.5,.15,1.3),glass,.2)
    for side in [-1,1]:
        for off in [-2,0,2]:cylinder('Rover wheel',(x+side*2.3,y+off,1.1),1.1,.7,dark,(0,math.pi/2,0),20)
    cylinder('Rover sensor mast',(x,y-1,4.6),.11,1.8,metal)
    box('Stereo sensor',(x,y-1,5.5),(.9,.45,.35),dark,.08)

def greenhouse(x,y,length=24):
    # Transparent pressure envelope, real framing, and planted growing beds.
    vertices=[];faces=[]
    for j in range(9):
        for i in range(25):
            a=i/24*math.pi
            vertices.append((x+5*math.cos(a),y-length/2+j*length/8,1+5*math.sin(a)))
    for j in range(8):
        for i in range(24):a=j*25+i;faces.append((a,a+1,a+26,a+25))
    mesh=bpy.data.meshes.new('Greenhouse glazing');mesh.from_pydata(vertices,[],faces);mesh.materials.append(clear)
    o=bpy.data.objects.new('Botanical pressure garden',mesh);bpy.context.scene.collection.objects.link(o)
    box('Greenhouse foundation',(x,y,.7),(10.7,length+1,1.4),white,.2)
    for row in [-3,0,3]:
        box('Growing bed',(x+row,y,1.6),(1.8,length-2,.7),dark)
        for i in range(12):sphere('Hydroponic crop',(x+row,y-length/2+2+i*(length-4)/12,2.1),(.65,.65,.65),green)
    for off in [-length/2,-length/4,0,length/4,length/2]:
        for i in range(16):
            a=i/16*math.pi;b=(i+1)/16*math.pi
            beam('Pressure garden arch',(x+5.08*math.cos(a),y+off,1+5.08*math.sin(a)),(x+5.08*math.cos(b),y+off,1+5.08*math.sin(b)),.11,metal)
    for side in [-1,1]:box('Garden light',(x+side*4.9,y,1.5),(.09,length,.1),warm)

def dome(x,y,r=10):
    import bmesh
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=r,location=(x,y,1.2));o=bpy.context.object
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<-.01],context='VERTS');bm.to_mesh(o.data);bm.free();finish(o,'Geodesic observatory',clear)
    edges=[(o.data.vertices[e.vertices[0]].co.copy()+o.location,o.data.vertices[e.vertices[1]].co.copy()+o.location) for e in o.data.edges]
    for a,b in edges:beam('Observatory triangulation',a,b,.055,metal)
    cylinder('Observatory plinth',(x,y,.7),r+.3,1.4,white,vertices=64)
    cylinder('Science core',(x,y,2.8),r*.35,4,white)
    cylinder('Instrument gallery',(x,y,4.9),r*.42,.5,warm)

def plaza(x,y,w=30,h=25):
    box('Service plaza',(x,y,.12),(w,h,.24),dark,.3)
    for side in [-1,1]:
        box('Wayfinding light',(x+side*w/2,y,.27),(.09,h,.05),warm)
    for off in range(-int(w/2),int(w/2)+1,6):
        cylinder('Walkway light mast',(x+off,y-h/2,1.1),.07,2.2,metal,vertices=8)
        box('Walkway light',(x+off,y-h/2,2.25),(.6,.25,.1),warm)


def ring(name,x,y,z,r,minor,material):
    bpy.ops.mesh.primitive_torus_add(major_segments=80,minor_segments=10,location=(x,y,z),major_radius=r,minor_radius=minor)
    o=finish(bpy.context.object,name,material)
    for f in o.data.polygons:f.use_smooth=True
    return o

def ring_habitat(x,y,r=16):
    # A raised annular district: inhabited decks, an open courtyard, and radial
    # pressure spokes. Its silhouette remains readable from the orbital descent.
    cylinder('Annular foundation',(x,y,1),r+3,2,dark,vertices=64)
    for z in [5,9]:
        ring('Ring habitat pressure deck',x,y,z,r,2.1,white)
        ring('Continuous observation ribbon',x,y,z+.1,r+1.99,.32,glass)
        ring('District navigation ribbon',x,y,z-1.1,r+1.82,.075,cyan)
    for i in range(12):
        a=i/12*math.tau;px=x+r*math.cos(a);py=y+r*math.sin(a)
        beam('Habitat buttress',(px,py,0),(px,py,11),.32,metal)
        if i%3==0:
            beam('Radial pressure gallery',(x,y,4),(px,py,4),1.1,white)
            beam('Transit guide light',(x,y,5.12),(px,py,5.12),.045,warm)
    dome(x,y,7)

def spire(x,y,height=38):
    cylinder('Science tower plinth',(x,y,2),8,4,white,vertices=12)
    cylinder('Science tower core',(x,y,height/2),3.4,height,metal,vertices=12)
    for z in [height*.4,height*.62,height*.82]:
        cylinder('Terraced research deck',(x,y,z),7.3,2.8,white,vertices=12)
        cylinder('Research deck glazing',(x,y,z+.1),7.4,1.3,glass,vertices=12)
        ring('Science deck beacon',x,y,z-1.2,7.2,.065,cyan)
    for i in range(3):
        a=i*math.tau/3
        beam('Tower stabilizer',(x+10*math.cos(a),y+10*math.sin(a),0),(x+3*math.cos(a),y+3*math.sin(a),height*.7),.48,white)
    cylinder('Laser communications mast',(x,y,height+6),.3,12,metal,vertices=12)
    sphere('Navigation beacon',(x,y,height+12),(.28,.28,.4),warm)

def transit(a,b):
    # Elevated enclosed transit with a legible light strip and real supports.
    beam('Elevated transit tube',(*a,5.5),(*b,5.5),1.3,white)
    beam('Transit observation strip',(*a,6.65),(*b,6.65),.15,glass)
    beam('Transit wayfinding',(*a,6.86),(*b,6.86),.055,cyan)
    for i in range(1,5):
        t=i/5;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
        beam('Transit pylon',(x,y,-1),(x,y,4.3),.45,metal)

def landing_berth(x,y,r=12):
    cylinder('Cargo landing berth',(x,y,.3),r,.6,dark,vertices=64)
    ring('Berth perimeter',x,y,.66,r-.5,.095,cyan)
    ring('Berth guidance circle',x,y,.67,r*.56,.07,warm)
    for i in range(8):
        a=i/8*math.tau
        box('Berth approach light',(x+(r+1.2)*math.cos(a),y+(r+1.2)*math.sin(a),.6),(.4,.4,.3),warm)

for world in ['moon','mars']:
    bpy.ops.wm.read_factory_settings(use_empty=True);random.seed(61)
    white=mat('Ceramic pressure skin',(.76,.79,.78),.2,.48)
    metal=mat('Titanium structure',(.37,.43,.46),.75,.3)
    dark=mat('Graphite composite',(.028,.039,.045),.35,.6)
    blue=mat('Photovoltaic cells',(.025,.065,.12),.7,.27)
    glass=mat('Coated blue glazing',(.035,.15,.19),.7,.2)
    gold=mat('Thermal foil',(.49,.29,.07),.75,.42)
    warm=mat('Amber navigation lights',(1,.47,.12),.2,.4,2)
    cyan=mat('Cold instrument lights',(.12,.65,.78),.2,.4,1.5)
    green=mat('Hydroponic planting',(.1,.25,.1),0,.85)
    clear=mat('Transparent pressure glazing',(.22,.47,.52),.15,.12)
    clear.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.36
    clear.surface_render_method='DITHERED'
    terrain(world)
    if world=='moon':
        for x,y in [(-15,5),(0,8),(15,5),(-15,28),(15,28)]:habitat(x,y)
        box('Connecting gallery',(0,18,3),(35,3.2,3.2),white,.5)
        cylinder('Central operations',(0,32,5),7,10,white,vertices=12)
        cylinder('Observation deck',(0,32,9),7.1,1.8,glass,vertices=12)
        cylinder('Shielded roof',(0,32,10.2),7.4,.6,white,vertices=12)
        solar(-48,5,3,3);dish(23,29);rover(-6,-15)
        for x,y in [(-52,43),(-37,43),(-52,65),(-37,65),(-15,55),(15,55),(-72,12),(-72,35)]:habitat(x,y,18)
        for y in [20,52]:box('District connection',(-43,y,3),(62,2.8,2.8),white,.4)
        dome(1,83,12)
        greenhouse(-29,-42,26);greenhouse(-44,-42,26)
        plaza(-9,-21,31,21);rover(-8,-24);rover(6,-24)
        # Fabrication workshop and rooftop radiator banks.
        box('Robotics assembly hall',(-68,-27,6),(18,27,12),white,.8)
        box('Workshop facade',(-68,-40.6,5),(14,.2,6),glass,.2)
        for x in [-74,-68,-62]:box('Workshop radiator',(x,-27,12.2),(4,22,.3),dark)
        dish(-73,68,13)
        solar(-89,70,2,5)
        # Cargo mass driver: twin acceleration rails and repeated coil frames.
        # Named anchors keep the browser's animated payload exactly on the rail.
        # The operational rail continues
        # beyond this architectural close-up; it is not an engineering blueprint.
        a=Vector((43,-85,2.2));b=Vector((60,120,34));direction=(b-a).normalized();side=Vector((-direction.y,direction.x,0)).normalized()
        for name,p in [('launch_start',a),('launch_exit',b)]:
            anchor=bpy.data.objects.new(name,None);anchor.location=p+Vector((0,0,1.45));bpy.context.scene.collection.objects.link(anchor)
        for sign in [-1,1]:beam('Mass driver rail',a+side*sign*2,b+side*sign*2,.32,metal)
        for i in range(34):
            t=i/33;p=a.lerp(b,t)
            for sign in [-1,1]:
                base=p+side*sign*3.1
                beam('Coil support',(base.x,base.y,0),base+Vector((0,0,2.8)),.24,dark)
                beam('Field coil',p+side*sign*2.9+Vector((0,0,.2)),p+side*sign*2.9+Vector((0,0,4)),.23,white)
                sphere('Active coil indicator',p+side*sign*2.5+Vector((0,0,2)),(.1,.1,.28),cyan)
            beam('Coil arch',p-side*2.9+Vector((0,0,4)),p+side*2.9+Vector((0,0,4)),.24,white)
            beam('Track bed',p-side*3.5,p+side*3.5,.25,dark)
        for i in range(6):box('Power capacitor',(-103+i*7,-55,2),(3.7,6,4),white,.3)
        ring_habitat(-113,32,17);ring_habitat(-101,91,13)
        spire(-35,111,38)
        transit((-113,32),(-52,43));transit((-101,91),(-52,65))
        transit((-52,65),(-35,111))
        landing_berth(15,-65,13);landing_berth(-14,-78,11)
        # Segmented launchport radiators and cargo loading aprons.
        for x in [77,87,97]:
            box('Launchport thermal radiator',(x,-53,7),(6,.4,14),dark,.15)
            beam('Radiator support',(x,-53,0),(x,-53,7),.3,metal)
            for z in [2,5,8,11]:box('Radiator fin',(x,-53,z),(6.2,.8,.09),metal)
        box('Launchport control cabin',(70,-79,4),(12,12,8),white,.8)
        box('Launchport glazing',(70,-85.1,5.7),(9,.15,2),glass)
        for i in range(7):
            box('Cargo thermal container',(77+(i%3)*6,-22+(i//3)*8,2),(4.7,6,4),gold,.25)

    else:
        # NASA MSH-inspired hybrid softgoods pressure volume and service lander.
        for x,y in [(-15,12),(13,17)]:
            cylinder('Habitat lander platform',(x,y,1.6),7.3,1.3,metal,vertices=12)
            cylinder('Expandable pressure habitat',(x,y,7),6.1,9.5,white)
            sphere('Shielded pressure dome',(x,y,11.7),(6.1,6.1,2.4),white)
            for i in range(12):
                a=i/12*2*math.pi;beam('Pressure restraint',(x+6.13*math.cos(a),y+6.13*math.sin(a),2.6),(x+6.13*math.cos(a),y+6.13*math.sin(a),11.5),.08,metal)
            cylinder('Upper glazing',(x,y,9.8),6.17,.6,glass)
            for side in [-1,1]:
                for off in [-1,1]:beam('Lander leg',(x+side*4,y+off*4,3),(x+side*8,y+off*8,0),.25,metal)
            box('Suitport airlock',(x,y-8,3.3),(4.5,5,4.5),white,.5)
            box('Radiator panel',(x+8,y,7),(1,8,5),dark)
        habitat(-15,-11,14);habitat(13,-9,14)
        box('Pressurized connection',(-1,13,3.4),(20,3,3),white,.4)
        rover(28,-12);dish(-30,14,11);solar(-50,-26,3,4)
        for x,y in [(-45,27),(-60,27),(-45,50),(-60,50),(-15,47),(13,49),(-76,7)]:habitat(x,y,18)
        greenhouse(-20,-41,28);greenhouse(-37,-41,28);greenhouse(-54,-41,28)
        dome(-55,81,13)
        plaza(12,-30,31,20);rover(7,-31);rover(20,-31)
        box('Geology and robotics hall',(-83,40,6),(19,30,12),white,.8)
        for y in [29,36,43,50]:box('Lab observation band',(-73.4,y,7),(.1,4.5,2),glass,.1)
        box('Science district connection',(-47,16,3),(68,2.8,2.8),white,.4)
        for x in [-45,-27,3]:box('District gallery',(x,35,3),(2.8,37,2.8),white,.4)
        solar(-97,-20,4,3)
        for x in [36,43,50]:
            cylinder('ISRU storage tank',(x,19,4),2.8,8,metal)
            sphere('Tank dome',(x,19,8),(2.8,2.8,1.4),metal)
        # A distant Starship-inspired transport, separated from living quarters.
        x,y=45,69
        cylinder('Landing apron',(x,y,.12),17,.25,dark,vertices=64)
        cylinder('Transport fuselage',(x,y,20),4.5,33,metal)
        vertices=[];faces=[]
        for j in range(25):
            z=36.5+j/24*15;r=max(.02,4.5*math.cos(j/24*math.pi/2))
            for i in range(48):a=i/48*math.pi*2;vertices.append((x+r*math.cos(a),y+r*math.sin(a),z))
        for j in range(24):
            for i in range(48):a=j*48+i;b=j*48+(i+1)%48;faces.append((a,b,b+48,a+48))
        mesh=bpy.data.meshes.new('Ogive');mesh.from_pydata(vertices,[],faces);mesh.materials.append(metal)
        for p in mesh.polygons:p.use_smooth=True
        o=bpy.data.objects.new('Transport ogive',mesh);bpy.context.scene.collection.objects.link(o)
        for a in [0,math.pi/2,math.pi,math.pi*1.5]:
            beam('Landing leg',(x+3*math.cos(a),y+3*math.sin(a),6),(x+7.8*math.cos(a),y+7.8*math.sin(a),.5),.45,dark)
            fin=box('Aft control surface',(x+4.6*math.cos(a),y+4.6*math.sin(a),7),(1,6,9),metal,.2);fin.rotation_euler[2]=a
        for z in range(7,35,3):
            bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=4,location=(x,y,z),major_radius=4.52,minor_radius=.04);finish(bpy.context.object,'Hull section seam',dark)
    if world=='mars':
        dome(-20,113,23)
        ring('Biosphere perimeter',-20,113,1.5,23.6,.14,cyan)
        ring_habitat(-109,80,18);ring_habitat(-105,17,14)
        spire(12,113,44)
        transit((-109,80),(-55,81));transit((-105,17),(-60,27))
        transit((-55,81),(-20,113));transit((-20,113),(12,113))
        landing_berth(83,18,15);landing_berth(89,64,12)
        for x in [-56,-42,-28]:
            greenhouse(x,150,24)
        for x in [18,32,46]:
            cylinder('Atmospheric processing tower',(x,153,8),3,16,white,vertices=16)
            ring('Processing tower service band',x,153,10,3.1,.13,cyan)
            dish(x,153,19)
    # Merge by material: dozens of draw calls, rather than hundreds of bolts.
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    groups={}
    for o in meshes:groups.setdefault(o.data.materials[0].name,[]).append(o)
    for name,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join();bpy.context.object.name=name
    bpy.ops.export_scene.gltf(filepath=str(output/f'{world}-outpost-v2.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_animations=False,export_materials='EXPORT',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    if render:
        scene=bpy.context.scene;scene.render.engine='CYCLES';prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='CUDA'
        scene.cycles.device='GPU';scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
        scene.world=bpy.data.worlds.new('Space');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.1,.14,.2,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.23
        bpy.ops.object.light_add(type='SUN',location=(-80,-80,100));sun=bpy.context.object;sun.data.energy=2.8;sun.data.angle=.035;sun.rotation_euler=(.5,-.6,-.7)
        bpy.ops.object.camera_add(location=(105,-150,90));camera=bpy.context.object;camera.rotation_euler=(Vector((0,8,2))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=42;scene.camera=camera
        scene.view_settings.view_transform='AgX';scene.render.filepath=f'/tmp/{world}-outpost-preview.png';bpy.ops.render.render(write_still=True)
    print(f'Exported {world}',flush=True)
