// Check actual packed lighting, not just different screenshots of different views.
// node lighting.mjs URL [output-directory] [spec|shadow|both]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const [base,out,which='both']=process.argv.slice(2), errors=[];
const b=await chromium.launch({args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist']});
try {
  const p=await b.newPage({viewport:{width:1024,height:640},reducedMotion:'no-preference'});
  p.on('pageerror',e=>errors.push(e.message)); p.on('requestfailed',r=>errors.push(r.url()));
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  async function load(room){
    const u=new URL(base);u.search=new URLSearchParams({room,shot:'hero',lightcheck:1,scale:1,tier:1,roll:120,chand:0,grain:0,bloom:0,vig:0,skip:'dust'});
    await p.goto(u.href);await p.waitForFunction(r=>window.__lobby?.mode().room===r&&document.querySelector('#loader.done'),room,{timeout:120000});
  }
  async function save(result){
    if(result.images&&out){await mkdir(out,{recursive:true});for(const [k,v] of Object.entries(result.images))await writeFile(`${out}/${k}.png`,Buffer.from(v.split(',')[1],'base64'));}
    delete result.images; console.log(JSON.stringify(result));
  }
  if(which!=='shadow'){
    await load('experience');
    const result=await p.evaluate(async wantImages=>{
      const {Vector3}=await import('three'), l=window.__lobby, gl=l.renderer.getContext(), W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
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
      return {room:'experience',polished,planar,images};
    },!!out);
    await save(result);for(const m of [result.polished,result.planar]){assert(m.worldPoints>80);assert(m.meanContributionA>1&&m.meanContributionB>1);assert(m.meanViewChange>1,'reflected radiance did not change with view');}
  }
  if(which!=='spec'){
    await load('about');
    const result=await p.evaluate(async wantImages=>{
      const T=await import('three'),l=window.__lobby,R=l.renderer,S=448,cam=new T.Camera(),sc=new T.Scene();let u;
      l.scene.traverse(o=>{if(o.userData.grp?.startsWith('floor')&&o.material?.uniforms?.tShadow)u=o.material.uniforms;});if(!u)throw new Error('No live sun on the floor');
      const rt=new T.WebGLRenderTarget(S,S,{depthBuffer:false}),mode={value:0};
      const m=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{sh:u.tShadow,vp:u.uSunVP,dir:u.uSunDir,mode},vertexShader:'varying vec2 st; void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D sh;uniform mat4 vp;uniform vec3 dir;uniform float mode;varying vec2 st;void main(){
        if(mode<.5){float z=texture2D(sh,st).r;float q=floor(z*65535.+.5);gl_FragColor=vec4(floor(q/256.)/255.,mod(q,256.)/255.,0.,1.);}
        else{vec3 w=vec3(mix(-6.8,6.8,st.x),.026,mix(-8.7,5.7,st.y));vec3 p=(vp*vec4(w,1.)).xyz*.5+.5;
          float open=0.;if(dir.y>0.&&all(greaterThan(p,vec3(0.)))&&all(lessThan(p,vec3(1.))))open=step(p.z-.00015,texture2D(sh,p.xy).r);gl_FragColor=vec4(vec3(open),1.);}}`});
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
  assert.deepEqual(errors,[]);
} finally {await b.close();}
