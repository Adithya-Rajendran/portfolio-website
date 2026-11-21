// Check actual packed lighting, not just different screenshots of different views.
// node lighting.mjs URL [output-directory] [spec|shadow|caster|all]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const [base,out,which='all']=process.argv.slice(2), errors=[];
assert(['spec','shadow','caster','all'].includes(which),'Unknown lighting check');
const b=await chromium.launch({args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist']});
try {
  const p=await b.newPage({viewport:{width:1024,height:640},reducedMotion:'no-preference'});
  p.on('pageerror',e=>errors.push(e.message)); p.on('requestfailed',r=>errors.push(r.url()));
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  async function load(room,params={}){
    const u=new URL(base);u.search=new URLSearchParams({room,shot:'hero',lightcheck:1,scale:1,tier:1,roll:120,chand:0,grain:0,bloom:0,vig:0,skip:'dust',...params});
    await p.goto(u.href);await p.waitForFunction(r=>window.__lobby?.mode().room===r&&document.querySelector('#loader.done'),room,{timeout:120000});
  }
  async function save(result){
    if(result.images&&out){await mkdir(out,{recursive:true});for(const [k,v] of Object.entries(result.images))await writeFile(`${out}/${k}.png`,Buffer.from(v.split(',')[1],'base64'));}
    delete result.images; console.log(JSON.stringify(result));
  }
  if(which==='all'||which==='spec'){
    await load('experience');
    const result=await p.evaluate(async wantImages=>{
      const T=await import('three'), {Vector3}=T, {uMirror}=await import('./js/kit.js'), l=window.__lobby, gl=l.renderer.getContext(), W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
      const uniforms=new Map();l.scene.traverse(o=>{for(const k of ['uSpecGain','uFloorRefl'])if(o.material?.uniforms?.[k]){
        if(!uniforms.has(k))uniforms.set(k,new Set());uniforms.get(k).add(o.material.uniforms[k]);}});
      const images={};function measure(key,eyes,target,patch,prefix){
        const group=uniforms.get(key);if(!group?.size)throw new Error(`Missing ${key} on the packed room`);
        const samples=eyes.map((eye,j)=>{
          const read=on=>{for(const u of group)u.value=on;l.lightFrame(eye,target,0);const px=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
            if(wantImages&&on)images[`${prefix}-${j}`]=l.renderer.domElement.toDataURL();return px;};
          const a=read(1),c=read(0);for(const u of group)u.value=1;
          const s=[];for(let iz=0;iz<13;iz++)for(let ix=0;ix<19;ix++){
            // Project the SAME physical points on the flat glass chart / floor into each camera.
            const v=new Vector3(patch[0]+ix*patch[1]/18,patch[2],patch[3]+iz*patch[4]/12).project(l.camera);
            if(Math.abs(v.x)>.98||Math.abs(v.y)>.98){s.push(null);continue;}
            const i=4*(Math.floor((v.y+1)*H/2)*W+Math.floor((v.x+1)*W/2));s.push([0,1,2].map(k=>a[i+k]-c[i+k]));
          }return s;
        });
        const v=samples[0].map((a,i)=>a&&samples[1][i]?[a,samples[1][i]]:null).filter(Boolean);
        const mag=x=>Math.max(...x.map(Math.abs)); const mean=f=>v.reduce((n,ab)=>n+f(...ab),0)/v.length;
        return {worldPoints:v.length,meanContributionA:+mean(a=>mag(a)).toFixed(2),meanContributionB:+mean((a,b)=>mag(b)).toFixed(2),meanViewChange:+mean((a,b)=>mag(a.map((x,i)=>x-b[i]))).toFixed(2)};
      }
      const polished=measure('uSpecGain',[[-1.1,1.34,4.2],[1.45,1.66,3.8]],[0,.624,2.14],[-.8,1.6,.624,1.55,1.0],'dial');
      const planar=measure('uFloorRefl',[[-1.8,1.55,6.9],[1.55,1.58,7.0]],[0,0,4.8],[-1.05,2.1,.002,4.30,1.0],'floor');
      // A lamp visible ONLY in the reflection should land at the projection of its virtual
      // image across the plane. Brightness differences alone cannot detect a reversed mirror.
      function landmark(plane,pos,eyes,target,onChart){
        const mat=new T.ShaderMaterial({uniforms:{uMirror},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float uMirror;void main(){${onChart?'':'if(uMirror<.5)discard;'}gl_FragColor=vec4(8.,0.,0.,1.);}`});
        const o=new T.Mesh(new T.SphereGeometry(.042,16,10),mat);o.position.fromArray(pos);if(onChart)o.layers.set(2);l.scene.add(o);
        const ds=eyes.map(eye=>{const read=on=>{o.visible=on;l.lightFrame(eye,target,0);const a=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
          const a=read(true),b=read(false),v=new Vector3(pos[0],2*plane-pos[1],pos[2]).project(l.camera),x=(1+v.x)*W/2,y=(1+v.y)*H/2;
          let weight=0,sx=0,sy=0;for(let j=Math.max(0,Math.floor(y)-32);j<Math.min(H,y+32);j++)for(let i=Math.max(0,Math.floor(x)-32);i<Math.min(W,x+32);i++){
            const n=(j*W+i)*4,k=Math.max(0,a[n]-b[n]-3);weight+=k;sx+=(i+.5)*k;sy+=(j+.5)*k;}
          return {signal:weight,errorPx:+Math.hypot(sx/weight-x,sy/weight-y).toFixed(2)};});
        l.scene.remove(o);mat.dispose();o.geometry.dispose();return ds;
      }
      const chartLandmark=landmark(.624,[.4,1.18,1.25],[[-1.1,1.34,4.2],[1.45,1.66,3.8]],[0,.624,2.14],true);
      const floorLandmark=landmark(0,[.1,.45,4.45],[[-1.8,1.55,6.9],[1.55,1.58,7.]],[0,0,4.8],false);
      return {room:'experience',polished,planar,chartLandmark,floorLandmark,images};
    },!!out);
    await save(result);for(const m of [result.polished,result.planar]){assert(m.worldPoints>80);assert(m.meanContributionA>1&&m.meanContributionB>1);assert(m.meanViewChange>1,'reflected radiance did not change with view');}
    for(const q of [...result.chartLandmark,...result.floorLandmark])assert(q.signal>200&&q.errorPx!==null&&q.errorPx<4,`Mirror registration: ${JSON.stringify(q)}`);
  }
  if(which==='all'||which==='shadow'){
    await load('about');
    const result=await p.evaluate(async wantImages=>{
      const T=await import('three'),{windowShadow}=await import('./js/sunlight.js'),l=window.__lobby,R=l.renderer,S=448,cam=new T.Camera(),sc=new T.Scene();let u;
      l.scene.traverse(o=>{if(o.userData.grp?.startsWith('floor')&&o.material?.uniforms?.tShadow)u=o.material.uniforms;});if(!u)throw new Error('No live sun on the floor');
      const rt=new T.WebGLRenderTarget(S,S,{depthBuffer:false}),mode={value:0};
      const m=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tShadow:u.tShadow,uSunVP:u.uSunVP,dir:u.uSunDir,mode},vertexShader:'varying vec2 st; void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D tShadow;uniform mat4 uSunVP;uniform vec3 dir;uniform float mode;varying vec2 st;
        ${windowShadow(2*7.7/2048,2048)} void main(){
        if(mode<.5){float z=texture2D(tShadow,st).r;float q=floor(z*65535.+.5);gl_FragColor=vec4(floor(q/256.)/255.,mod(q,256.)/255.,0.,1.);}
        else{vec3 w=vec3(mix(-6.8,6.8,st.x),.026,mix(-8.7,5.7,st.y));float open=windowVisibility(w,vec3(0.,1.,0.),dir.y);gl_FragColor=vec4(vec3(open),1.);}}`});
      const plane=new T.Mesh(new T.PlaneGeometry(2,2),m);plane.frustumCulled=false;sc.add(plane);
      const read=k=>{mode.value=k;R.setRenderTarget(rt);R.render(sc,cam);const a=new Uint8Array(S*S*4);R.readRenderTargetPixels(rt,0,0,S,S,a);R.setRenderTarget(null);return a;};
      const images={},snap=(eye,at,t,name)=>{l.lightFrame(eye,at,t);if(wantImages)images[name]=R.domElement.toDataURL();return {map:read(0),floor:read(1),vp:u.uSunVP.value.toArray()};};
      const a=snap([0,1.55,3.9],[0,1.05,-3],0,'sun-rest'),v=snap([-1.6,1.85,2.8],[0,.8,-2.5],0,'sun-other-eye'),z=snap([0,1.55,3.9],[0,1.05,-3],18,'sun-rotated');
      const delta=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1])n++;return n;};
      rt.dispose();m.dispose();plane.geometry.dispose();
      return {room:'about',samples:S*S,shadowMapCamera:delta(a.map,v.map),floorMaskCamera:delta(a.floor,v.floor),lightMatrixCamera:Math.max(...a.vp.map((n,i)=>Math.abs(n-v.vp[i]))),shadowMapRoll:delta(a.map,z.map),floorMaskRoll:delta(a.floor,z.floor),images};
    },!!out);
    await save(result);assert.equal(result.lightMatrixCamera,0);assert.equal(result.shadowMapCamera,0);assert.equal(result.floorMaskCamera,0);assert(result.shadowMapRoll>100&&result.floorMaskRoll>100);
  }
  if(which==='all'||which==='caster'){
    await load('writing',{rollat:0});
    const result=await p.evaluate(async()=>{
      const T=await import('three'),{uMirror,DSCALE}=await import('./js/kit.js'),l=window.__lobby,R=l.renderer,root=l.scene.getObjectByName('Catalogue drone'),S=768;
      if(!root)throw new Error('Missing live catalogue drone');const pick=l.picks.find(p=>p.options?.length);if(!pick)throw new Error('Missing catalogue');
      let u;l.scene.traverse(o=>{if(o.userData.grp?.startsWith('floor')&&o.material?.uniforms?.tShadow)u=o.material.uniforms;});
      const sc=new T.Scene(),cam=new T.Camera(),rt=new T.WebGLRenderTarget(S,S,{depthBuffer:false});
      const mat=new T.ShaderMaterial({uniforms:{sh:u.tShadow},depthTest:false,depthWrite:false,vertexShader:'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D sh;varying vec2 st;void main(){float q=floor(texture2D(sh,st).r*65535.+.5);gl_FragColor=vec4(floor(q/256.)/255.,mod(q,256.)/255.,0.,1.);}`});
      const plane=new T.Mesh(new T.PlaneGeometry(2,2),mat);plane.frustumCulled=false;sc.add(plane);
      const frame=t=>l.lightFrame([0,1.8,2.9],[0,1.1,-2.6],t);
      function depths(){const a=new Uint8Array(S*S*4);R.setRenderTarget(rt);R.render(sc,cam);R.readRenderTargetPixels(rt,0,0,S,S,a);R.setRenderTarget(null);return a;}
      function caster(t){root.visible=true;frame(t);const a=depths();root.visible=false;frame(t);const b=depths();root.visible=true;
        const mask=new Uint8Array(S*S);for(let i=0;i<mask.length;i++)mask[i]=+(a[i*4]*256+a[i*4+1]<b[i*4]*256+b[i*4+1]);return mask;}
      // A/B only the directional term on the actual PBR meshes, with the SAME depth map and PMREM.
      root.traverse(o=>{if(o.material?.isMeshStandardMaterial){o.layers.enable(3);if(!o.material.transparent)o.layers.enable(4);}});
      const received=t=>{const trg=root.position.clone(),eye=trg.clone().add(new T.Vector3(.55,.6,-1.15));l.lightFrame(eye.toArray(),trg.toArray(),t);
        const rt2=new T.WebGLRenderTarget(256,256),E=u.uSunE.value.clone(),bg=l.scene.background;l.camera.layers.set(3);l.scene.background=new T.Color(0);
        const read=()=>{const a=new Uint8Array(256*256*4);R.setRenderTarget(rt2);R.render(l.scene,l.camera);R.readRenderTargetPixels(rt2,0,0,256,256,a);return a;};const a=read();u.uSunE.value.setScalar(0);const b=read();u.uSunE.value.copy(E);R.setRenderTarget(null);rt2.dispose();l.scene.background=bg;l.camera.layers.set(0);
        let n=0;for(let i=0;i<a.length;i+=4)if(a[i]-b[i]>2||a[i+1]-b[i+1]>2||a[i+2]-b[i+2]>2)n++;return n;};
      const a=caster(0),atRest=received(0);
      // The planar floor reads distance from reflection alpha to blur a distant object
      // more than a contact. Check the actual opaque PBR material against ray/mesh hits.
      const probeRT=new T.WebGLRenderTarget(192,192,{type:T.HalfFloatType}),rc=new T.Raycaster(),distErrors=[];
      const oldBg=l.scene.background;l.scene.background=new T.Color(0);l.camera.layers.set(4);rc.layers.set(4);uMirror.value=1;R.setRenderTarget(probeRT);R.render(l.scene,l.camera);
      for(const x of [85,91,96,101,107])for(const y of [85,91,96,101,107]){
        rc.setFromCamera(new T.Vector2(2*(x+.5)/192-1,2*(y+.5)/192-1),l.camera);const hit=rc.intersectObject(root,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});if(!hit)continue;
        const px=new Uint16Array(4);R.readRenderTargetPixels(probeRT,x,y,1,1,px);distErrors.push(Math.abs(T.DataUtils.fromHalfFloat(px[3])/DSCALE-hit.distance));}
      uMirror.value=0;l.camera.layers.set(0);l.scene.background=oldBg;R.setRenderTarget(null);probeRT.dispose();
      pick.options[0][1](); for(let i=1;i<=15;i++)frame(i*.05);
      const b=caster(.75),inFlight=received(.75);let moved=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])moved++;
      rt.dispose();mat.dispose();plane.geometry.dispose();const count=x=>x.reduce((a,b)=>a+b,0);
      return {room:'writing',fixedRollDeg:0,depthSamples:S*S,droneOccludedSamplesAtDock:count(a),droneOccludedSamplesInFlight:count(b),casterMaskChanged:moved,litDronePixelsAtDock:atRest,litDronePixelsInFlight:inFlight,opaqueDistanceHits:distErrors.length,maxDistanceErrorM:+Math.max(...distErrors).toFixed(4)};
    });
    await save(result);assert(result.droneOccludedSamplesAtDock>20&&result.casterMaskChanged>20,'Drone did not cast a moving sun shadow');assert(Math.max(result.litDronePixelsAtDock,result.litDronePixelsInFlight)>30,'The drone did not receive window sun');assert(result.opaqueDistanceHits>=5&&result.maxDistanceErrorM<.008,'Incorrect distance in the floor reflection of the drone');
  }
  assert.deepEqual(errors,[]);
} finally {await b.close();}
