// Layer 6: stylised 3D city builder (three.js r128).
// A small city on a coast. Power plants appear, grow and disappear as the energy
// mix changes; smog thickens with fossil share; day and night follow the same
// clock as the hourly dispatch chart.
window.CityScene = function(canvas, opts = {}){
  const T = THREE;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new T.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true}); // keeps the frame so screenshots work
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(42, 1, 1, 1500);
  scene.fog = new T.Fog(0xa9c3dd, 220, 620);

  // seeded random so the layout is the same every time
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const M = (c, o = {}) => new T.MeshStandardMaterial({color:c, roughness:.85, metalness:.05, ...o});
  const box = (w,h,d,mat,x=0,y=0,z=0) => { const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat); m.position.set(x,y+h/2,z); m.castShadow=m.receiveShadow=true; return m; };
  const cyl = (rt,rb,h,mat,x=0,y=0,z=0,seg=12) => { const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),mat); m.position.set(x,y+h/2,z); m.castShadow=true; return m; };

  /* lights */
  const hemi = new T.HemisphereLight(0xdfe9f5, 0x40513b, .7); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff1dc, 1.1); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left:-170, right:170, top:170, bottom:-170, near:10, far:700});
  scene.add(sun, sun.target);

  /* land, sea, hills, roads */
  const sea = new T.Mesh(new T.PlaneGeometry(1400, 1400), M(0x2f6482, {roughness:.35, metalness:.25}));
  sea.rotation.x = -Math.PI/2; sea.position.y = -.6; sea.receiveShadow = true; scene.add(sea);
  scene.add(box(240, 1, 360, M(0x6f8f5a), -60, -1, 0));
  scene.add(box(8, .6, 360, M(0xcdbf94), 64, -1, 0));
  const hillMat = M(0x5d7a4c, {flatShading:true});
  [[-150,-150,46,30],[-95,-140,40,26],[-40,-150,48,34],[25,-145,40,24],[-175,-80,34,20],[-10,-118,22,14],[-38,-112,20,12]].forEach(([x,z,r,h])=>{
    const m = new T.Mesh(new T.ConeGeometry(r, h, 7), hillMat); m.position.set(x, h/2-.5, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  });
  const roadMat = M(0x3b3f46);
  scene.add(box(3.4,.08,300, roadMat, 0, 0, 20), box(220,.08,3.4, roadMat, -40, 0, 0), box(3.4,.08,120, roadMat, 40, 0, 40));

  /* city blocks */
  const bMats = [0xc9ced6,0xaab3bf,0x8e99a8,0xd8d2c4].map((c,i)=>M(c,{emissive:0xffc870, emissiveIntensity:0, roughness:.7}));
  for(let x=-26; x<=26; x+=4.4) for(let z=-26; z<=26; z+=4.4){
    const r = Math.hypot(x,z); if(r>27 || Math.abs(x)<2.6 || Math.abs(z)<2.6) continue;
    if(rnd()<.12) continue;
    const h = 2 + Math.pow(Math.max(0,1-r/28),1.6)*26*(.45+rnd()*.75);
    scene.add(box(3.2, h, 3.2, bMats[Math.floor(rnd()*4)], x, 0, z));
  }

  /* smoke and steam particles */
  const puffGeo = new T.SphereGeometry(1, 7, 5), puffs = [];
  function emit(world, col, size, dark){
    if(puffs.length > 420) return;
    const mat = new T.MeshLambertMaterial({color:col, transparent:true, opacity:dark?.55:.45, depthWrite:false});
    const m = new T.Mesh(puffGeo, mat); m.position.copy(world); m.scale.setScalar(size*.5);
    m.userData = {life:0, max:4+rnd()*2, size, vx:.9+rnd()*.6, vz:(rnd()-.5)*.6, base:dark?.55:.45};
    scene.add(m); puffs.push(m);
  }

  /* building blocks for each technology */
  const white = M(0xf1f3f5), concrete = M(0xbfc3c7), steel = M(0x9aa3ad), dark = M(0x5c6168);
  const F = {
    onshore(){ return turbine(false); },
    offshore(){ return turbine(true); },
    solar(){
      const g = new T.Group(), pm = M(0x1d3557,{metalness:.6, roughness:.3}), post = M(0x8d939e);
      g.add(box(15,.05,10, M(0x8a8f78), 0,0,0));
      for(let i=0;i<5;i++) for(let j=0;j<4;j++){ const p = new T.Mesh(new T.BoxGeometry(2.5,.08,1.4), pm); p.position.set(-5.6+i*2.8, 1, -3.3+j*2.2); p.rotation.x = -.5; p.castShadow = true; g.add(p, cyl(.06,.06,1,post,-5.6+i*2.8,0,-3.3+j*2.2,4)); }
      return {group:g};
    },
    csp(){
      const g = new T.Group(); g.add(cyl(.6,.9,18, concrete));
      const rec = new T.Mesh(new T.CylinderGeometry(1.1,1.1,2.4,10), M(0xfff3b0,{emissive:0xffd060, emissiveIntensity:1})); rec.position.y = 18.5; g.add(rec);
      const mir = M(0xc9d6e3,{metalness:.9, roughness:.15});
      for(let k=0;k<46;k++){ const a = k/46*Math.PI*2, r = 6 + (k%3)*2.6; const m = new T.Mesh(new T.BoxGeometry(1.2,.06,.8), mir); m.position.set(Math.cos(a)*r, .8, Math.sin(a)*r); m.lookAt(0,22,0); g.add(m); }
      return {group:g, tick:(dt,t,env)=>{ rec.material.emissiveIntensity = .2 + env.day*1.4; }};
    },
    gas(){
      const g = new T.Group(); g.add(box(9,5,6, steel), box(5,3,5, concrete, 7.5,0,0), cyl(.7,.9,15, M(0xb7bec7), -3,0,-3.5));
      return {group:g, stacks:[[-3,15.3,-3.5,0xcfd3d6,1.3,false]]};
    },
    coal(){
      const g = new T.Group(); g.add(box(13,7,8, M(0x6e737a)), cyl(1,1.4,24, M(0x8d939e), -4,0,-6), cyl(1,1.4,24, M(0x8d939e), 2,0,-6));
      const pile = new T.Mesh(new T.ConeGeometry(4,3,8), M(0x24262a)); pile.position.set(9,1.5,4); g.add(pile);
      return {group:g, stacks:[[-4,24.5,-6,0x4a4d52,2,true],[2,24.5,-6,0x4a4d52,2,true]]};
    },
    diesel(){
      const g = new T.Group(); g.add(box(2.4,1.6,1.4, M(0x40513b)), box(2.4,1.6,1.4, M(0x40513b), 3,0,0), cyl(.12,.12,2.2, dark, 0,0,0,6));
      return {group:g, stacks:[[0,2.4,0,0x3a3c40,.7,true]]};
    },
    nuclear(){
      const g = new T.Group(), pts = [];
      for(let y=0;y<=16;y+=1) pts.push(new T.Vector2(3.6*Math.sqrt(1+Math.pow((y-10)/5.5,2))*.72, y));
      const tm = new T.MeshStandardMaterial({color:0xd9dcdf, roughness:.9, side:T.DoubleSide});
      [[-6,0],[3,0]].forEach(([x,z])=>{ const t = new T.Mesh(new T.LatheGeometry(pts, 20), tm); t.position.set(x,0,z); t.castShadow = true; g.add(t); });
      g.add(cyl(3,3,5, concrete, 10,0,6)); const dome = new T.Mesh(new T.SphereGeometry(3,16,8,0,Math.PI*2,0,Math.PI/2), concrete); dome.position.set(10,5,6); g.add(dome);
      return {group:g, stacks:[[-6,16.5,0,0xffffff,2.6,false],[3,16.5,0,0xffffff,2.6,false]]};
    },
    hydro(){
      const g = new T.Group(); g.add(box(30,11,3, concrete));
      const lake = new T.Mesh(new T.PlaneGeometry(34,24), M(0x3a7aa0,{roughness:.3, metalness:.2})); lake.rotation.x = -Math.PI/2; lake.position.set(0,9.5,-13); g.add(lake);
      const spill = box(4,10,1.2, M(0xe6f2fa,{emissive:0x9fd3f0, emissiveIntensity:.2}), 0,0,2.2); g.add(spill);
      return {group:g};
    },
    battery(){
      const g = new T.Group(), cm = M(0xe8e4d8), led = new T.MeshBasicMaterial({color:0x5cc98a});
      for(let i=0;i<3;i++) for(let j=0;j<2;j++){ g.add(box(2.6,1.4,1.1, cm, i*3, 0, j*1.8)); const l = new T.Mesh(new T.BoxGeometry(.3,.12,.05), led); l.position.set(i*3,1.1,j*1.8+.57); g.add(l); }
      return {group:g};
    },
    biomass(){
      const g = new T.Group(); g.add(box(7,5,6, M(0x8a7f6a)), cyl(1.4,1.4,7, M(0xb5a789), 6,0,-2), cyl(.5,.6,11, M(0x9b8f78), -2,0,-2.5));
      const wood = M(0x6b4f2e); for(let i=0;i<6;i++){ const l = new T.Mesh(new T.CylinderGeometry(.35,.35,4,6), wood); l.rotation.z = Math.PI/2; l.position.set(-1+(i%3)*.75, .4+Math.floor(i/3)*.7, 5); g.add(l); }
      return {group:g, stacks:[[-2,11.3,-2.5,0xb8ad98,1.2,true]]};
    },
    geothermal(){
      const g = new T.Group(); g.add(box(6,3.5,4, steel));
      for(let i=0;i<3;i++){ const p = new T.Mesh(new T.CylinderGeometry(.3,.3,9,8), M(0xc9ced6)); p.rotation.z = Math.PI/2; p.position.set(-1, 1+i*.8, -3-i); g.add(p); }
      return {group:g, stacks:[[-4,3.6,-2,0xffffff,1.6,false],[2,3.6,-4,0xffffff,1.3,false]]};
    }
  };
  function turbine(off){
    const g = new T.Group(), rotor = new T.Group();
    if(off) g.add(cyl(.7,.7,2, M(0xe7b44c), 0,-1,0));
    g.add(cyl(.22,.4,11, white)); g.add(box(.8,.7,1.8, white, 0,10.8,0));
    rotor.position.set(0,11.2,1.05); g.add(rotor);
    for(let i=0;i<3;i++){ const arm = new T.Group(); arm.rotation.z = i*2*Math.PI/3; const b = new T.Mesh(new T.BoxGeometry(.3,6,.08), white); b.position.y = 3; b.castShadow = true; arm.add(b); rotor.add(arm); }
    const lamp = new T.Mesh(new T.SphereGeometry(.18,6,6), new T.MeshBasicMaterial({color:0xff3b30})); lamp.position.y = 11.7; g.add(lamp);
    const sp = 1 + rnd()*.6, ph = rnd()*3; g.rotation.y = -.5;
    return {group:g, tick:(dt,t,env)=>{ rotor.rotation.z -= dt*sp*env.wind; lamp.visible = env.night>.35 && ((t+ph)%1.8)<.5; }};
  }

  /* where each technology goes */
  const grid = (x0,x1,z0,z1,step,order=[0,0]) => { const s=[]; for(let x=x0;x<=x1;x+=step) for(let z=z0;z<=z1;z+=step) s.push([x+(rnd()-.5)*step*.3, z+(rnd()-.5)*step*.3]); return s.sort((a,b)=>Math.hypot(a[0]-order[0],a[1]-order[1])-Math.hypot(b[0]-order[0],b[1]-order[1])); };
  const SLOTS = {
    onshore: grid(-165,-78,-110,120,13,[-78,0]),
    offshore: grid(82,170,-110,110,15,[82,0]),
    solar: [[-55,36],[-38,36],[-55,50],[-38,50],[-55,64],[-38,64],[-21,50],[-21,64],[-55,78],[-38,78],[-21,78],[-55,92],[-38,92],[-21,92],[-55,106],[-38,106],[-21,106],[-21,36]],
    csp: [[-6,124],[-30,130],[18,132]],
    gas: [[34,34],[52,34],[34,52],[52,52]],
    coal: [[34,74],[52,74],[34,96],[52,96]],
    biomass: [[14,62],[14,82],[14,102]],
    nuclear: [[48,-40],[48,-72]],
    hydro: [[-24,-104]],
    battery: [[30,-8],[30,2],[30,12],[39,-8],[39,2],[39,12],[30,-18],[39,-18]],
    geothermal: [[-48,-62],[-62,-48],[-34,-78]],
    diesel: Array.from({length:8},(_,i)=>{ const a = i/8*Math.PI*2+.3; return [Math.cos(a)*33, Math.sin(a)*33]; })
  };
  const UNIT = {onshore:[60,72], offshore:[60,60], solar:[40,18], csp:[12,3], gas:[10,4], coal:[10,4], diesel:[40,8], nuclear:[9,2], hydro:[30,1], battery:[90,8], biomass:[12,3], geothermal:[12,3]};
  const live = Object.fromEntries(Object.keys(SLOTS).map(k=>[k,[]]));
  const dying = [];
  function countsFor(mix){
    const out = {};
    for(const k in UNIT){ const s = mix[k]||0, [per,max] = UNIT[k]; let n = Math.round(s*per); if(s>.015 && n<1) n = 1; out[k] = Math.min(max, n); }
    return out;
  }
  function spawn(k, i){
    const unit = F[k](), [x,z] = SLOTS[k][i];
    unit.group.position.set(x, 0, z); unit.group.scale.setScalar(.001); unit.born = 0; unit.k = k;
    unit.emitters = (unit.stacks||[]).map(([sx,sy,sz,col,size,dirty])=>({local:new T.Vector3(sx,sy,sz), col, size, dirty, acc:rnd()}));
    scene.add(unit.group); return unit;
  }
  let mixNow = {};
  function setMix(mix){
    mixNow = mix; const want = countsFor(mix);
    for(const k in live){
      const arr = live[k];
      while(arr.length < want[k]) arr.push(spawn(k, arr.length));
      while(arr.length > want[k]){ const u = arr.pop(); u.dying = 0; dying.push(u); }
    }
  }
  const counts = () => Object.fromEntries(Object.entries(live).map(([k,a])=>[k,a.length]));

  /* camera orbit */
  let theta = .75, phi = 1.0, radius = 250, dragging = null, paused = false, hourHeld = 12;
  const target = new T.Vector3(-10, 0, 10);
  canvas.addEventListener('pointerdown', e=>{ dragging = {x:e.clientX, y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e=>{ if(!dragging) return; theta -= (e.clientX-dragging.x)*.006; phi = Math.min(1.42, Math.max(.3, phi-(e.clientY-dragging.y)*.005)); dragging = {x:e.clientX, y:e.clientY}; });
  canvas.addEventListener('pointerup', ()=>{ dragging = null; });
  canvas.addEventListener('wheel', e=>{ e.preventDefault(); radius = Math.min(420, Math.max(60, radius*Math.exp(e.deltaY*.001))); }, {passive:false});
  const ro = new ResizeObserver(()=>{ const w = canvas.clientWidth, h = canvas.clientHeight; if(!w||!h) return; renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix(); });
  ro.observe(canvas);

  /* main loop */
  const sky = new T.Color(), night = new T.Color(0x0b1220), day = new T.Color(0xa9c3dd), dusk = new T.Color(0xe8a87c), smog = new T.Color(0x9c8f78);
  let running = false, last = 0, raf = 0;
  const wv = new T.Vector3();
  function frame(now){
    if(!running) return;
    const dt = Math.min(.05, (now-last)/1000 || 0); last = now;
    const hour = paused ? hourHeld : (reduceMotion ? 13 : (now/450)%24); hourHeld = hour;
    const ang = (hour-6)/12*Math.PI, elev = Math.sin(ang), dayF = Math.max(0, Math.min(1, elev*1.8+.15)), nightF = 1-dayF;
    sun.position.set(Math.cos(ang)*260, Math.max(20, elev*300), 120); sun.intensity = 1.15*dayF; hemi.intensity = .18+.55*dayF;
    const duskF = Math.max(0, 1-Math.abs(elev)*4)*(elev>-.2?1:0);
    sky.copy(night).lerp(day, dayF).lerp(dusk, duskF*.35);
    const fossil = (mixNow.gas||0)+(mixNow.coal||0)*1.6+(mixNow.diesel||0)*1.3+(mixNow.biomass||0)*.4;
    const fogCol = sky.clone().lerp(smog, Math.min(.65, fossil*.8)*(.4+.6*dayF));
    scene.background = fogCol; scene.fog.color.copy(fogCol);
    scene.fog.far = 640 - Math.min(1,fossil)*380; scene.fog.near = 90 + (1-Math.min(1,fossil))*150;
    bMats.forEach((m,i)=>{ m.emissiveIntensity = nightF*(.35+i*.15); });
    if(!dragging && !reduceMotion) theta += dt*.025;
    camera.position.set(target.x+radius*Math.sin(phi)*Math.cos(theta), radius*Math.cos(phi), target.z+radius*Math.sin(phi)*Math.sin(theta));
    camera.lookAt(target);
    const env = {day:dayF, night:nightF, wind:1};
    for(const k in live) for(const u of live[k]){
      if(u.born < 1){ u.born = Math.min(1, u.born+dt*1.6); const e = u.born, s = 1+2.2*Math.pow(e-1,3)+1.2*Math.pow(e-1,2); u.group.scale.setScalar(reduceMotion?1:Math.max(.001,s)); }
      u.tick && u.tick(dt, now/1000, env);
      for(const em of u.emitters){
        em.acc += dt*(em.dirty?3.2:2.2);
        while(em.acc > 1){ em.acc -= 1; wv.copy(em.local).multiplyScalar(u.group.scale.x).add(u.group.position); emit(wv, em.col, em.size, em.dirty); }
      }
    }
    for(let i=dying.length-1;i>=0;i--){ const u = dying[i]; u.dying += dt*2; u.group.scale.setScalar(Math.max(.001, 1-u.dying)); if(u.dying>=1){ scene.remove(u.group); dying.splice(i,1); } }
    for(let i=puffs.length-1;i>=0;i--){
      const p = puffs[i], d = p.userData; d.life += dt;
      p.position.y += dt*3.2; p.position.x += dt*d.vx; p.position.z += dt*d.vz;
      p.scale.setScalar(d.size*(.5+d.life*.55)); p.material.opacity = Math.max(0, d.base*(1-d.life/d.max));
      if(d.life >= d.max){ scene.remove(p); p.material.dispose(); puffs.splice(i,1); }
    }
    opts.onTick && opts.onTick(hour);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  return {
    setMix, counts,
    start(){ if(running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop(){ running = false; cancelAnimationFrame(raf); },
    togglePause(){ paused = !paused; return paused; }
  };
};
