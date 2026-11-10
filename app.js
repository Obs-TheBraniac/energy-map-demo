// Energy Map concept demo. MapLibre globe over a real street map (OpenFreeMap),
// with the screening model computed live in the browser.
(async function(){
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const $ = id => document.getElementById(id);

/* ---------- technologies and criteria ---------- */
const TECH = {
  solar:   {name:'Solar PV',      color:css('--solar'),   capex:480,  fom:7,   vom:0,  life:35, learn:0.030, firm:45, crit:{emissions:.95,reliability:.30,land:.40,water:.92,jobs:.80,security:.85,access:.92}},
  onshore: {name:'Onshore wind',  color:css('--onshore'), capex:1200, fom:25,  vom:5,  life:25, learn:0.012, firm:25, crit:{emissions:.97,reliability:.45,land:.55,water:.96,jobs:.60,security:.85,access:.60}},
  offshore:{name:'Offshore wind', color:css('--offshore'),capex:1800, fom:50,  vom:3,  life:25, learn:0.020, firm:20, crit:{emissions:.97,reliability:.60,land:.92,water:.96,jobs:.62,security:.85,access:.30}},
  csp:     {name:'Solar thermal (CSP)', color:css('--csp'), capex:4500, fom:70, vom:3, life:30, learn:0.025, firm:8, crit:{emissions:.93,reliability:.65,land:.35,water:.35,jobs:.70,security:.85,access:.40}},
  gas:     {name:'Gas CCGT',      color:css('--gas'),     capex:700,  fom:15,  vom:4,  life:25, learn:0,     cf:.55, eff:.55, ef:.365, fuel:'gas', crit:{emissions:.30,reliability:.95,land:.95,water:.50,jobs:.40,security:null,access:.55}},
  coal:    {name:'Coal',          color:css('--coal'),    capex:2000, fom:45,  vom:5,  life:40, learn:0,     cf:.80, eff:.38, ef:.90,  fuel:'coal', crit:{emissions:.05,reliability:.90,land:.80,water:.30,jobs:.55,security:.60,access:.40}},
  diesel:  {name:'Diesel generators', color:css('--diesel'), capex:500, fom:15, vom:10, life:15, learn:0,   cf:.50, eff:.35, ef:.70,  fuel:'oil', crit:{emissions:.15,reliability:.80,land:.97,water:.75,jobs:.30,security:.35,access:.97}},
  nuclear: {name:'Nuclear',       color:css('--nuclear'), capex:6500, fom:110, vom:16, life:60, learn:0.005, cf:.90, crit:{emissions:.96,reliability:.97,land:.96,water:.30,jobs:.55,security:.70,access:.20}},
  hydro:   {name:'Hydro',         color:css('--hydro'),   capex:2500, fom:40,  vom:2,  life:60, learn:0,     crit:{emissions:.90,reliability:.70,land:.20,water:.40,jobs:.50,security:.90,access:.50}},
  geothermal:{name:'Geothermal',  color:css('--geothermal'), capex:4000, fom:100, vom:2, life:30, learn:0.01, crit:{emissions:.92,reliability:.95,land:.85,water:.50,jobs:.55,security:.95,access:.35}},
  biomass: {name:'Biomass',       color:css('--biomass'), capex:3000, fom:90,  vom:6,  life:25, learn:0,     cf:.75, eff:.32, ef:.05,  fuel:'bio', crit:{emissions:.70,reliability:.85,land:.25,water:.45,jobs:.80,security:.70,access:.60}}
};
// [construction job-years per MW, permanent O&M jobs per MW]. Placeholder factors.
const JOBS = {solar:[13,.3],onshore:[8,.4],offshore:[12,.5],csp:[15,.8],gas:[3,.15],coal:[6,.3],diesel:[2,.2],nuclear:[12,.6],hydro:[10,.3],geothermal:[10,.5],biomass:[9,1.5]};
const GEO = new Set([352,404,360,608,554,484,840,380,792,392,231,222,188,152,320,558]);
const CRITERIA = ['cost','emissions','reliability','land','water','jobs','security','access'];
const CRIT_LABEL = {cost:'Cost',emissions:'Emissions',reliability:'Reliability',land:'Land',water:'Water',jobs:'Jobs',security:'Security',access:'Access'};
const SHORT = {cost:'Cost',emissions:'CO₂',reliability:'Firm',land:'Land',water:'Water',jobs:'Jobs',security:'Secur.',access:'Access'};
const weights = {cost:3,emissions:2,reliability:2,land:1,water:1,jobs:1,security:1,access:1};

/* ---------- regions ---------- */
const REGIONS = {
  826:{name:'United Kingdom', tier:'c', solarCF:.111, windCF:.401, offCF:.48, hydroCF:null, geoCF:null, wacc:6,  carbon:80, gas:35, coal:12, oil:55, bio:22, gasSec:.40, nuclear:true, baseEF:.365, twh:40, local:40,
       real:{solar:true,onshore:true,offshore:true,gas:true},
       sub:'1 km cells · 241,997 km² land · 28.1% excluded (slope, density)',
       pypsa:{offshore:.37,onshore:.17,solar:.12,gas:.15,nuclear:.13,biomass:.06}},
  566:{name:'Nigeria', tier:'c', solarCF:.19, windCF:.16, offCF:.30, hydroCF:.45, geoCF:null, wacc:12, carbon:0, gas:12, coal:10, oil:45, bio:14, gasSec:.80, nuclear:false, baseEF:.48, twh:30, local:30,
       real:{}, sub:'Second build region · data not yet downloaded',
       pypsa:{gas:.46,solar:.27,hydro:.19,diesel:.05,onshore:.03}}
};
function genericRegion(f){
  const [, lat] = d3.geoCentroid(f); const a = Math.abs(lat);
  const h = (+f.id*9301+49297)%233280/233280;
  return {name:f.properties.name, tier:'a', generic:true,
    solarCF: .10 + .12*Math.exp(-(((a-24)/22)**2)) + (h-.5)*.02,
    windCF:  .17 + .25*Math.exp(-(((a-55)/15)**2)) + (h-.5)*.05,
    offCF:   .24 + .26*Math.exp(-(((a-55)/15)**2)),
    hydroCF: h>.62 ? .42 : null, geoCF: GEO.has(+f.id) ? .85 : null,
    wacc: lat>35||lat<-35 ? 7 : 11, carbon:30, gas:28, coal:10, oil:50, bio:18, gasSec:.55, nuclear:true, baseEF:.50, twh:30, local:35, real:{},
    sub:'Globe-wide coarse tier · placeholder resource from latitude', pypsa:null};
}

/* ---------- economics: precomputed physics, live economics ---------- */
const S = {year:2025,wacc:6,carbon:80,gas:35,firm:40,twh:40,local:40};
const crf = (r,n)=> r===0 ? 1/n : r*(1+r)**n/((1+r)**n-1);
function cfOf(k,R){
  switch(k){
    case 'solar': return R.solarCF; case 'onshore': return R.windCF; case 'offshore': return R.offCF;
    case 'hydro': return R.hydroCF; case 'geothermal': return R.geoCF;
    case 'csp': return R.solarCF>=.17 ? Math.min(.6,R.solarCF*2.3) : null;
    default: return TECH[k].cf;
  }
}
const capexAt = (k,mult=1)=> TECH[k].capex*mult*Math.pow(1-TECH[k].learn, S.year-2025);
function lcoe(key, R, capexMult=1){
  const t = TECH[key]; const r = S.wacc/100;
  const cf = cfOf(key,R); if(!cf) return null;
  let v = (capexAt(key,capexMult)*crf(r,t.life)+t.fom)/(8.76*cf) + t.vom;
  if(t.fuel){ const price = t.fuel==='gas' ? S.gas : R[t.fuel]; v += price/t.eff + S.carbon*t.ef; }
  if(key==='nuclear') v += 6;
  if(t.firm) v += t.firm*S.firm/100;
  return v;
}
function available(R){ return Object.keys(TECH).filter(k=> cfOf(k,R) && !(k==='nuclear'&&!R.nuclear) && !(TECH[k].fuel && TECH[k].fuel!=='gas' && R[TECH[k].fuel]==null)); }
function evaluate(R){
  const rows = available(R).map(k=>({k, v:lcoe(k,R), lo:lcoe(k,R,.85), hi:lcoe(k,R,1.15)}));
  const min = Math.min(...rows.map(r=>r.v));
  const wsum = CRITERIA.reduce((s,c)=>s+weights[c],0)||1;
  rows.forEach(r=>{
    const c = {...TECH[r.k].crit};
    c.cost = min/r.v;
    if(r.k==='gas') c.security = R.gasSec;
    if(TECH[r.k].firm) c.reliability = Math.min(1, c.reliability + .5*S.firm/100);
    r.crit = c;
    r.score = CRITERIA.reduce((s,k)=>s+weights[k]*c[k],0)/wsum;
  });
  return rows.sort((a,b)=>b.score-a.score);
}
function cheapest(R){ let best=null,bv=Infinity; for(const k of available(R)){const v=lcoe(k,R); if(v<bv){bv=v;best=k;}} return best; }

/* ---------- geography ---------- */
const TOPO = await (await fetch('data/countries-110m.json')).json();
const countries = topojson.feature(TOPO, TOPO.objects.countries).features.filter(f=>f.properties.name!=='Antarctica');
// a few areas (N. Cyprus, Somaliland, Kosovo) have no id in the source data; give them their own
countries.forEach((f,i)=>{ if(f.id==null) f.id = String(9000+i); f.properties.id = +f.id; });
// Copies of the shapes for drawing, with rings unwrapped across the dateline so
// Russia and Fiji are not drawn the long way round the globe.
function unwrapRing(ring){ let prev=ring[0][0]; return ring.map(([x,y],i)=>{ if(i){ while(x-prev>180) x-=360; while(x-prev<-180) x+=360; } prev=x; return [x,y]; }); }
const drawFeatures = countries.map(f=>{
  const g=f.geometry, polys = g.type==='Polygon' ? [g.coordinates] : g.coordinates;
  return {type:'Feature', id:+f.id, properties:{...f.properties}, geometry:{type:'MultiPolygon', coordinates:polys.map(p=>p.map(unwrapRing))}};
});
const regionOf = new Map(countries.map(f=>[+f.id, REGIONS[+f.id] || genericRegion(f)]));
const byId = new Map(countries.map(f=>[+f.id,f]));

const hash = (x,y)=>{ const s=Math.sin(x*127.1+y*311.7)*43758.5453; return s-Math.floor(s); };
function vnoise(x,y){ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi, u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  const a=hash(xi,yi), b=hash(xi+1,yi), c=hash(xi,yi+1), d=hash(xi+1,yi+1); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
const fbm = (x,y)=> .55*vnoise(x,y)+.3*vnoise(x*2.3,y*2.3)+.15*vnoise(x*5.1,y*5.1)-.5;
function cellsFor(id, step, fn){
  const f = byId.get(id); const [[x0,y0],[x1,y1]] = d3.geoBounds(f); const out=[]; const sy=step*.62;
  const base = {...REGIONS[id], offCF:null, hydroCF:null, geoCF:null, nuclear:false};
  for(let x=x0;x<=x1;x+=step) for(let y=y0;y<=y1;y+=sy)
    if(d3.geoContains(f,[x,y])) out.push({x,y,sx:step,sy,cid:id,R:{...base,...fn(x,y)}});
  return out;
}
const CELLS = cellsFor(826,.1,(x,y)=>({solarCF:.111*(1+.045*(52.5-y))+fbm(x*1.5,y*1.5)*.012,
    windCF:Math.max(.2,.401+.02*(y-53)+.015*(-3-x)+fbm(x*1.2+7,y*1.2)*.16)}))
  .concat(cellsFor(566,.15,(x,y)=>({solarCF:.15+.007*(y-4)+fbm(x,y)*.015, windCF:.10+.012*(y-4)+fbm(x+3,y)*.06})));
const tierB = [[-3.2,55.9],[-1.5,53.4],[-4.1,52.3],[0.9,52.6],[-6.3,54.6],[3.4,6.5],[7.5,9.1],[8.5,12.0],[13.1,11.8],[6.0,5.5]];

/* ---------- layer colouring ---------- */
const seqSolar = d3.scaleSequential(d3.interpolateRgbBasis(['#2a2f4a','#7a4b3a','#d98a2b','#ffd166'])).domain([.08,.22]);
const seqWind  = d3.scaleSequential(d3.interpolateRgbBasis(['#1f2c48','#1f5f73','#2fa59a','#a8f0d6'])).domain([.15,.45]);
const seqJobs  = d3.scaleSequentialLog(d3.interpolateRgbBasis(['#2a2446','#5a3a7a','#a45ca8','#f0a0c8'])).domain([500,15000]).clamp(true);
const jobsPerTWh = (k,R)=> JOBS[k][0]*1000/(8.76*cfOf(k,R));
let layer='best';
const TECH_KEYS = Object.keys(TECH);
// Static values (solar, wind, coverage) are stored once as feature properties.
// Values that move with the sliders (cheapest technology, jobs) live in feature
// state, so a slider move only touches the shapes whose answer changed and the
// map never has to re-cut its tiles. Switching tabs only swaps a style rule.
drawFeatures.forEach(f=>{ const R=regionOf.get(f.id); f.properties.s=R.solarCF; f.properties.w=R.windCF; f.properties.t=R.tier==='c'?1:0; });
const countryFC = {type:'FeatureCollection', features:drawFeatures};
const cellFC = {type:'FeatureCollection', features: CELLS.map((c,i)=>({type:'Feature', id:i, properties:{i, s:c.R.solarCF, w:c.R.windCF, t:1},
  geometry:{type:'Polygon', coordinates:[[[c.x-c.sx/2,c.y-c.sy/2],[c.x+c.sx/2,c.y-c.sy/2],[c.x+c.sx/2,c.y+c.sy/2],[c.x-c.sx/2,c.y+c.sy/2],[c.x-c.sx/2,c.y-c.sy/2]]]}}))};
const ramp = (prop, scale)=>{ const [a,b]=scale.domain(); const out=['interpolate',['linear'],prop];
  for(let t=0;t<=1.0001;t+=.25){ out.push(a+t*(b-a), d3.color(scale(a+t*(b-a))).formatHex()); } return out; };
const FILL = {
  best: ['match',['coalesce',['feature-state','b'],-1], ...TECH_KEYS.flatMap((k,i)=>[i,TECH[k].color]), '#2c3a58'],
  solar: ramp(['get','s'], seqSolar),
  wind: ramp(['get','w'], seqWind),
  jobs: ['interpolate',['linear'],['coalesce',['feature-state','j'],2.7],
         ...[0,.25,.5,.75,1].flatMap(t=>{ const v=500*Math.pow(30,t); return [Math.log10(v), d3.color(seqJobs(v)).formatHex()]; })],
  tier: ['case',['==',['get','t'],1], css('--good'), '#2c3a58'],
  none: '#000000'
};
const lastState = new Map(); // "source:id" -> "best|jobs" last sent to the map
function recolor(){
  for(const f of countries){ f.properties.best = cheapest(regionOf.get(+f.id)); }
  for(const c of CELLS) c.best = cheapest(c.R);
}
function pushState(){
  if(!ready) return;
  const send = (source,id,best,R)=>{
    const b = TECH_KEYS.indexOf(best), j = Math.round(Math.log10(jobsPerTWh(best,R))*100)/100, key = source+':'+id, v = b+'|'+j;
    if(lastState.get(key)===v) return;
    lastState.set(key,v); map.setFeatureState({source, id},{b, j});
  };
  for(const f of countries) send('countries', +f.id, f.properties.best, regionOf.get(+f.id));
  CELLS.forEach((c,i)=> send('cells', i, c.best, c.R));
}

/* ---------- map ---------- */
recolor();
const map = new maplibregl.Map({
  container:'map', style:'https://tiles.openfreemap.org/styles/dark',
  center:[2,38], zoom:1.6, attributionControl:{compact:true}, maxZoom:17
});
new ResizeObserver(()=>map.resize()).observe($('map'));
window.energyMap = map; // handy for poking at it from the browser console
map.addControl(new maplibregl.NavigationControl({visualizePitch:false}), 'top-right');
map.addControl(new maplibregl.ScaleControl({unit:'metric'}), 'bottom-left');
const popup = new maplibregl.Popup({closeButton:false, closeOnClick:false, offset:12, maxWidth:'360px'});

let ready=false, spinning=!reduceMotion, selectedId=826, selectedCell=null;
map.on('style.load', ()=>{
  try{ map.setProjection({type:'globe'}); }catch(e){}
  try{ map.setSky({'sky-color':'#0b1220','horizon-color':'#1b2b4a','fog-color':'#0b1220','atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,5,1,7,0]}); }catch(e){}
  // put energy layers under roads, buildings and labels so the street map reads through
  const firstAbove = map.getStyle().layers.find(l=>/^(building|highway|road|railway|aeroway|boundary|place|water_name)/.test(l.id));
  const before = firstAbove ? firstAbove.id : undefined;
  map.addSource('countries',{type:'geojson', data:countryFC});
  map.addSource('cells',{type:'geojson', data:cellFC});
  map.addLayer({id:'countries-fill', type:'fill', source:'countries', paint:{
    'fill-color':FILL[layer],
    'fill-opacity':['interpolate',['linear'],['zoom'],0,.82,4,.7,6,.25,8,.08]}}, before);
  map.addLayer({id:'cells-fill', type:'fill', source:'cells', minzoom:3.5, paint:{
    'fill-color':FILL[layer],
    'fill-opacity':['interpolate',['linear'],['zoom'],3.5,0,4.5,.85,8,.65,10,.38,12,.26,15,.16]}}, before);
  map.addLayer({id:'cells-line', type:'line', source:'cells', minzoom:8, paint:{'line-color':'#0b1220','line-opacity':.35,'line-width':.6}}, before);
  map.addLayer({id:'cells-sel', type:'line', source:'cells', filter:['==',['get','i'],-1], paint:{'line-color':'#e6ecf6','line-width':2.2}});
  map.addLayer({id:'countries-sel', type:'line', source:'countries', filter:['==',['get','id'],selectedId], paint:{'line-color':'#e6ecf6','line-width':1.6,'line-opacity':['interpolate',['linear'],['zoom'],5,1,8,.3]}});
  // Tier B sample sites as HTML markers so the pulse is a CSS animation, not a per-frame style change
  tierB.forEach(p=>{ const el=document.createElement('div'); el.className='tierb'; el.title='Tier B sample site (hourly model, not yet run)'; new maplibregl.Marker({element:el}).setLngLat(p).addTo(map); });
  ready=true; applyLayerVisibility(); update();
});

function applyLayerVisibility(){
  if(!ready) return;
  if(layer!=='none'){ map.setPaintProperty('countries-fill','fill-color',FILL[layer]); map.setPaintProperty('cells-fill','fill-color',FILL[layer]); }
  const vis = layer==='none' ? 'none' : 'visible';
  map.setLayoutProperty('countries-fill','visibility',vis);
  map.setLayoutProperty('cells-fill','visibility', layer==='none'||layer==='tier' ? 'none' : 'visible');
  map.setLayoutProperty('cells-line','visibility', layer==='none'||layer==='tier' ? 'none' : 'visible');
}

/* animation: globe spin, Tier B pulse, dispatch sweep */
const stopSpin = ()=> setSpin(false);
['mousedown','touchstart','wheel'].forEach(ev=> map.getCanvas().addEventListener(ev, stopSpin, {passive:true}));
function frame(now){
  if(ready && spinning && !map.isMoving()){
    const c = map.getCenter(); map.jumpTo({center:[c.lng+0.08, c.lat]});
  }
  $('zoomv').textContent = 'z '+map.getZoom().toFixed(1);
  drawDispatch(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* hover and click */
const fmtLL = (x,y)=> `${Math.abs(y).toFixed(2)}°${y>=0?'N':'S'} ${Math.abs(x).toFixed(2)}°${x>=0?'E':'W'}`;
const n0=d3.format(',.0f'), n1=d3.format(',.1f');
function countryTip(id){
  const R = regionOf.get(id), best = byId.get(id).properties.best; let v='';
  if(layer==='best'||layer==='none') v=`${TECH[best].name} · £${Math.round(lcoe(best,R))}/MWh`;
  if(layer==='solar') v=`solar CF ${R.solarCF.toFixed(3)}`;
  if(layer==='wind') v=`wind CF ${R.windCF.toFixed(3)}`;
  if(layer==='jobs') v=`${n0(Math.round(jobsPerTWh(best,R)/10)*10)} job-years per TWh/yr`;
  if(layer==='tier') v= R.tier==='c'?'Tiers A, B, C':'Tier A only';
  return `<b>${R.name}</b> <span>${v}</span>`;
}
const cellTip = c=> `<b>Cell ${fmtLL(c.x,c.y)}</b> <span>${TECH[c.best].name} £${Math.round(lcoe(c.best,c.R))}/MWh · wind ${c.R.windCF.toFixed(3)} · solar ${c.R.solarCF.toFixed(3)}</span>`;
function hit(point){
  if(!ready || layer==='none') return {};
  const fs = map.queryRenderedFeatures(point,{layers:['cells-fill','countries-fill'].filter(l=>map.getLayoutProperty(l,'visibility')!=='none')});
  const cf = fs.find(f=>f.layer.id==='cells-fill'), co = fs.find(f=>f.layer.id==='countries-fill');
  return {cell: cf ? CELLS[cf.properties.i] : null, country: co ? co.properties.id : (cf ? CELLS[cf.properties.i].cid : null)};
}
map.on('mousemove', e=>{
  const {cell,country} = hit(e.point);
  map.getCanvas().style.cursor = (cell||country) ? 'pointer' : '';
  if(cell && map.getZoom()>=4.5) popup.setLngLat(e.lngLat).setHTML(cellTip(cell)).addTo(map);
  else if(country) popup.setLngLat(e.lngLat).setHTML(countryTip(country)).addTo(map);
  else popup.remove();
});
map.on('mouseout', ()=>popup.remove());
map.on('click', e=>{
  const {cell,country} = hit(e.point);
  if(cell && map.getZoom()>=4.5){ select(cell.cid,false,cell); return; }
  if(country) select(country, true);
});
function flyToCountry(id){
  const f = byId.get(id); const [[w,s],[e,n]] = d3.geoBounds(f);
  if(e>w && e-w<120) map.fitBounds([[w,s],[e,n]],{padding:{top:60,bottom:60,left:320,right:60}, duration:reduceMotion?0:1800, maxZoom:7});
  else { const [lng,lat]=d3.geoCentroid(f); map.flyTo({center:[lng,lat], zoom:2.6, duration:reduceMotion?0:1800}); }
}

/* ---------- panel ---------- */
const sliders = {year:$('s-year'),wacc:$('s-wacc'),carbon:$('s-carbon'),gas:$('s-gas'),firm:$('s-firm'),twh:$('s-twh'),local:$('s-local')};
const fmt = {year:v=>v, wacc:v=>(+v).toFixed(1)+'%', carbon:v=>'£'+v+'/t', gas:v=>'£'+v+'/MWh', firm:v=>v+'%', twh:v=>v+' TWh/yr', local:v=>v+'%'};
function syncOutputs(){ for(const k in sliders){ sliders[k].value=S[k]; $('o-'+k).textContent=fmt[k](S[k]); } }
for(const k in sliders) sliders[k].addEventListener('input',()=>{ S[k]=+sliders[k].value; $('o-'+k).textContent=fmt[k](S[k]); scheduleUpdate(); });
function regionDefaults(R){ S.wacc=R.wacc; S.carbon=R.carbon; S.gas=R.gas; S.twh=R.twh; S.local=R.local; syncOutputs(); }
$('reset').addEventListener('click',()=>{ regionDefaults(regionOf.get(selectedId)); update(); });

function select(id, fly, cell=null){
  const changed = id!==selectedId;
  selectedId=id; selectedCell=cell;
  if(changed || !cell) regionDefaults(regionOf.get(id));
  if(fly){ setSpin(false); flyToCountry(id); }
  if(ready){
    map.setFilter('countries-sel',['==',['get','id'],id]);
    map.setFilter('cells-sel',['==',['get','i'], cell ? CELLS.indexOf(cell) : -1]);
  }
  update();
}

let lastRows=[], lastR=null, updateQueued=false;
// slider drags fire many input events; run at most one full update per frame
function scheduleUpdate(){ if(updateQueued) return; updateQueued=true; requestAnimationFrame(()=>{ updateQueued=false; update(); }); }
function update(){
  recolor(); pushState();
  const R = selectedCell
    ? {...selectedCell.R, sub:`Cell ${fmtLL(selectedCell.x,selectedCell.y)} · about ${Math.round(selectedCell.sy*111)} km across · Reset view returns to the country`}
    : regionOf.get(selectedId);
  const rows = evaluate(R); lastRows=rows; lastR=R;
  $('p-name').textContent = R.name;
  $('p-sub').textContent = R.sub;
  const tier=$('p-tier');
  tier.className='tier '+(R.tier==='c'?'c':'a');
  tier.textContent = selectedCell ? 'Single cell · Tier A' : R.tier==='c' ? 'Tiers A · B · C' : 'Tier A screening';
  $('p-stats').innerHTML = statsFor(R)
    .map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  $('rank').innerHTML = rows.map((r,i)=>{
    const t=TECH[r.k], real=R.real[r.k];
    return `<li><span class="n">${i+1}</span>
      <span class="nm"><i style="background:${t.color}"></i>${t.name}<span class="src ${real?'real':''}">${real?'Layer 1 data':'placeholder'}</span></span>
      <span class="sc">${(r.score*100).toFixed(0)}</span>
      <div class="bar"><div class="fill" style="width:${(r.score*100).toFixed(1)}%;background:${t.color}"></div></div>
      <div class="lcoe"><span>£${Math.round(r.v)}/MWh</span><span>${Math.round(r.lo)} to ${Math.round(r.hi)}</span></div></li>`;
  }).join('');
  const cellC = d3.scaleSequential(d3.interpolateRgbBasis(['#3a1f2b','#6b4a3a','#8a8a4a','#3f9c7a','#5cc98a'])).domain([0,1]);
  $('matrix').innerHTML = `<tr><th></th>${CRITERIA.map(c=>`<th title="${CRIT_LABEL[c]}">${SHORT[c]}</th>`).join('')}</tr>` +
    rows.map(r=>`<tr><td>${TECH[r.k].name}</td>${CRITERIA.map(c=>`<td title="${CRIT_LABEL[c]}: ${r.crit[c].toFixed(2)}"><div class="cell" style="background:${cellC(r.crit[c])}"></div></td>`).join('')}</tr>`).join('');
  const top = rows.slice(0,5), tot = top.reduce((s,r)=>s+r.score**4,0);
  const scr = Object.fromEntries(top.map(r=>[r.k, r.score**4/tot]));
  const stack = mix => Object.entries(mix).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="flex-basis:${v*100}%;background:${TECH[k].color}" title="${TECH[k].name} ${Math.round(v*100)}%">${v>.09?Math.round(v*100)+'%':''}</div>`).join('');
  $('cmp').innerHTML = `<div><div class="lbl"><span>Screening (Tier A), weighted</span><span class="tier a">live</span></div><div class="stack">${stack(scr)}</div></div>`+
    (R.pypsa ? `<div><div class="lbl"><span>PyPSA least-cost mix (Tier C)</span><span class="tier ph">mock result</span></div><div class="stack">${stack(R.pypsa)}</div></div>`
             : `<div><div class="lbl"><span>PyPSA least-cost mix (Tier C)</span><span class="tier ph">not modelled</span></div><div class="stack"></div></div>`);
  $('cmp-note').textContent = R.pypsa
    ? 'A per-cell ranking is not an energy mix. The gap between these two bars is the point of the comparison view.'
    : 'Full optimisation covers the UK first, then Nigeria. Other countries get screening only.';
  economics(R, scr);
  renderTab(R);
  legend();
}

/* ---------- tab-specific side panel ---------- */
const TIERB_NAMES = ['Central Scotland','South Yorkshire','Mid Wales','East Anglia','Northern Ireland','Lagos','Abuja','Kano','Maiduguri','Niger Delta'];
const gbp = v=> v==null ? 'n/a' : '£'+Math.round(v);
const sitesIn = id=> tierB.map((p,i)=>({p,name:TIERB_NAMES[i]})).filter(s=>d3.geoContains(byId.get(id),s.p));
function statsFor(R){
  const cheap = cheapest(R);
  switch(layer){
    case 'solar': return [['Solar CF',R.solarCF.toFixed(3)],['Annual yield',n0(R.solarCF*8760)+' kWh/kWp'],['Solar LCOE',gbp(lcoe('solar',R))+'/MWh']];
    case 'wind': return [['Onshore CF',R.windCF.toFixed(3)],['Offshore CF',R.offCF?R.offCF.toFixed(3):'n/a'],['Onshore LCOE',gbp(lcoe('onshore',R))+'/MWh']];
    case 'jobs': return [['Cheapest option',TECH[cheap].name],['Build jobs per TWh',n0(jobsPerTWh(cheap,R))],['Permanent per TWh',n0(JOBS[cheap][1]*1000/(8.76*cfOf(cheap,R)))]];
    case 'tier': return [['Screening','Yes'],['Hourly sites',String(sitesIn(selectedId).length)],['Optimisation',R.tier==='c'?'Planned':'No']];
    case 'none': return [['Solar CF',R.solarCF.toFixed(3)],['Wind CF',R.windCF.toFixed(3)],['Cost of capital',S.wacc.toFixed(1)+'%']];
    default: {
      if(selectedId===826){
        const uk = CELLS.filter(c=>c.cid===826);
        return [['Solar CF',R.solarCF.toFixed(3)],['Wind CF',R.windCF.toFixed(3)],['Solar cheapest',Math.round(uk.filter(c=>lcoe('solar',c.R)<lcoe('onshore',c.R)).length/uk.length*100)+'% of cells']];
      }
      return [['Solar CF',R.solarCF.toFixed(3)],['Wind CF',R.windCF.toFixed(3)],['Cost of capital',S.wacc.toFixed(1)+'%']];
    }
  }
}
function renderTab(R){
  document.querySelectorAll('.rail section[data-show]').forEach(s=>{ s.hidden = !s.dataset.show.split(' ').includes(layer); });
  if(layer==='solar'||layer==='wind') renderResource(R);
  if(layer==='jobs') renderJobsTech(R);
  if(layer==='tier') renderTiers(R);
}
function renderResource(R){
  const solar = layer==='solar', key = solar?'solarCF':'windCF', tech = solar?'solar':'onshore', scale = solar?seqSolar:seqWind;
  $('res-title').textContent = solar ? 'Solar resource' : 'Wind resource';
  // histogram: cells if this country has them, otherwise all countries
  const cells = CELLS.filter(c=>c.cid===selectedId);
  const vals = cells.length ? cells.map(c=>c.R[key]) : countries.map(f=>regionOf.get(+f.id)[key]);
  const here = selectedCell ? selectedCell.R[key] : R[key];
  const lo = d3.min(vals), hi = d3.max(vals), nb = 22, w = (hi-lo)/nb || 1;
  const bins = new Array(nb).fill(0); vals.forEach(v=>bins[Math.min(nb-1,Math.floor((v-lo)/w))]++);
  const hb = Math.min(nb-1,Math.max(0,Math.floor((here-lo)/w))), mx = d3.max(bins);
  $('hist').innerHTML = bins.map((b,i)=>`<div class="${i===hb?'here':''}" style="height:${Math.max(2,b/mx*100)}%;background:${scale(lo+(i+.5)*w)}" title="${(lo+i*w).toFixed(3)} to ${(lo+(i+1)*w).toFixed(3)}: ${b}"></div>`).join('');
  $('hist-label').textContent = cells.length ? `Capacity factor across ${n0(cells.length)} cells` : 'Capacity factor across countries';
  $('hist-note').textContent = cells.length ? `median ${d3.median(vals).toFixed(3)}` : 'cells only for UK and Nigeria';
  $('hist-axis').innerHTML = `<span>${lo.toFixed(2)}</span><span>outlined bar = ${selectedCell?'this cell':'this place'}</span><span>${hi.toFixed(2)}</span>`;
  // cost against the alternatives
  const alts = available(R).map(k=>({k,v:lcoe(k,R)})).sort((a,b)=>a.v-b.v);
  const show = [alts.find(a=>a.k===tech), ...alts.filter(a=>a.k!==tech).slice(0,4)].filter(Boolean).sort((a,b)=>a.v-b.v);
  const vmax = d3.max(show,d=>d.v);
  $('res-vs').innerHTML = `<div class="lbl"><span>${TECH[tech].name} against the cheapest alternatives</span><span>£/MWh</span></div>` +
    show.map(a=>`<div class="row"><span style="${a.k===tech?'color:var(--ink);font-weight:600':''}">${TECH[a.k].name}</span><div class="b" style="width:${a.v/vmax*100}%;background:${TECH[a.k].color}"></div><span>${Math.round(a.v)}</span></div>`).join('');
  // strongest countries
  const ranked = countries.map(f=>({id:+f.id, name:regionOf.get(+f.id).name, v:regionOf.get(+f.id)[key]})).sort((a,b)=>b.v-a.v);
  let list = ranked.slice(0,8).map((r,i)=>({...r,rank:i+1}));
  const selRank = ranked.findIndex(r=>r.id===selectedId);
  if(selRank>=8) list.push({...ranked[selRank], rank:selRank+1});
  const top = ranked[0].v;
  $('res-top').innerHTML = list.map(r=>`<li class="${r.id===selectedId?'sel':''}"><span class="n">${r.rank}</span><span class="nm">${r.name}</span><div class="b" style="width:${r.v/top*100}%;background:${scale(r.v)}"></div><span class="v">${r.v.toFixed(3)}</span></li>`).join('');
  $('res-note').textContent = solar
    ? (selectedId===826 ? 'UK value is the Layer 1 median from the Global Solar Atlas. ' : 'Value for this country is a placeholder until its data is processed. ') + 'Annual yield is capacity factor times 8,760 hours.'
    : (selectedId===826 ? 'Layer 1 check: at 785 real UK wind farms the atlas gives a net capacity factor of 0.432, but the fleet achieved 0.245 (DUKES 2026). The atlas layers are gross, so real output is lower than the map suggests.' : 'Value for this country is a placeholder until the Global Wind Atlas data is processed.');
}
function renderJobsTech(R){
  const rows = available(R).map(k=>({k, v:jobsPerTWh(k,R)})).sort((a,b)=>b.v-a.v), mx = rows[0].v;
  $('jobs-tech').innerHTML = rows.map((r,i)=>`<li><span class="n">${i+1}</span><span class="nm"><i style="background:${TECH[r.k].color}"></i>${TECH[r.k].name}</span><div class="b" style="width:${r.v/mx*100}%;background:${TECH[r.k].color}"></div><span class="v">${n0(r.v)}</span></li>`).join('');
}
function renderTiers(R){
  const c = R.tier==='c', uk = selectedId===826;
  const T = [
    ['a','A','Screening', 'Annual-average resource and costs per cell, computed live in your browser.', uk ? '1 km cells, Layer 1 in progress' : c ? '1 km cells planned' : 'Coarse country value, placeholder', true],
    ['c','B','Hourly single-site model', 'One-node PyPSA runs with hourly wind, solar, demand and storage at sample sites.', c ? 'Planned, not run yet' : 'Not planned here', c],
    ['c','C','Regional optimisation', 'PyPSA-Earth capacity expansion and dispatch with the transmission network.', uk ? 'First region' : c ? 'Second region' : 'Only the UK and Nigeria', c]
  ];
  $('tiers').innerHTML = T.map(([cls,l,name,desc,status,on])=>`<li class="${on?'':'off'}"><span class="tier ${on?cls:'ph'}">Tier ${l}</span><b>${name} · ${status}</b><span class="d">${desc}</span></li>`).join('');
  const s = sitesIn(selectedId);
  $('sites').innerHTML = `<h2 style="margin-top:18px">Hourly sample sites</h2>` + (s.length
    ? `<ol class="sitelist">${s.map(x=>`<li><span>${x.name}</span><span>${fmtLL(x.p[0],x.p[1])}</span></li>`).join('')}</ol>`
    : `<p class="note" style="margin-top:0">No hourly sample sites in this country.</p>`);
}

/* ---------- Layer 5: economic impact (placeholder multipliers) ---------- */
const GDP_MULT = 1.8;
function tween(el, to, f){
  const from = +el.dataset.v || 0; el.dataset.v = to;
  if(reduceMotion){ el.textContent=f(to); return; }
  const t0=performance.now(), d=500;
  cancelAnimationFrame(+el.dataset.raf||0);
  const step=now=>{ const k=Math.min(1,(now-t0)/d), e=d3.easeCubicOut(k); el.textContent=f(from+(to-from)*e); if(k<1) el.dataset.raf=requestAnimationFrame(step); };
  el.dataset.raf=requestAnimationFrame(step);
}
function economics(R, mix){
  let gw=0, inv=0, jb=0, jo=0, ef=0; const jobsBy={}, invBy={};
  for(const [k,share] of Object.entries(mix)){
    const cap = share*S.twh/(8.76*cfOf(k,R));
    const i = capexAt(k)*cap/1000;
    gw+=cap; inv+=i; invBy[k]=i;
    jobsBy[k]=JOBS[k][0]*cap*1000; jb+=jobsBy[k]; jo+=JOBS[k][1]*cap*1000;
    ef += share*(TECH[k].ef||0);
  }
  const gdp = inv*S.local/100*GDP_MULT, co2 = S.twh*(R.baseEF-ef);
  const el=$('econ');
  if(!el.children.length){
    el.innerHTML = [['inv','Investment','£bn'],['gw','New capacity','GW'],['jb','Construction jobs','job-years'],['jo','Permanent jobs','O&M'],['gdp','GDP added','£bn'],['co2','CO₂ avoided','Mt/yr']]
      .map(([id,k,u])=>`<div><div class="k">${k}</div><div><span class="v" id="e-${id}">0</span><span class="u">${u}</span></div></div>`).join('');
  }
  tween($('e-inv'),inv,n1); tween($('e-gw'),gw,n1); tween($('e-jb'),jb,n0); tween($('e-jo'),jo,n0); tween($('e-gdp'),gdp,n1); tween($('e-co2'),co2,n1);
  const stk=(by,tot,fv)=>Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="flex-basis:${v/tot*100}%;background:${TECH[k].color}" title="${TECH[k].name} ${fv(v)}">${v/tot>.12?Math.round(v/tot*100)+'%':''}</div>`).join('');
  $('jobstack').innerHTML = stk(jobsBy, jb||1, v=>n0(v)+' job-years');
  $('invstack').innerHTML = stk(invBy, inv||1, v=>'£'+n1(v)+'bn');
}

function legend(){
  const el=$('legend');
  if(layer==='best'){
    const used=new Set(countries.map(f=>f.properties.best)); CELLS.forEach(c=>used.add(c.best));
    el.innerHTML=`<div class="ttl">Cheapest technology by LCOE</div><div class="sw">${Object.keys(TECH).filter(k=>used.has(k)).map(k=>`<span><i style="background:${TECH[k].color}"></i>${TECH[k].name}</span>`).join('')}</div><div style="margin-top:6px">Zoom into the UK or Nigeria for cells and streets. Click a cell for its own ranking.</div>`;
  } else if(layer==='jobs'){
    const d=seqJobs.domain(), stops=d3.range(0,1.01,.25).map(t=>seqJobs(d[0]*Math.pow(d[1]/d[0],t))).join(',');
    el.innerHTML=`<div class="ttl">Construction job-years per TWh/yr, cheapest option</div><div class="ramp" style="background:linear-gradient(90deg,${stops})"></div><div class="ramp-l"><span>500</span><span>15,000</span></div><div style="margin-top:6px">Placeholder job factors.</div>`;
  } else if(layer==='solar'||layer==='wind'){
    const sc = layer==='solar'?seqSolar:seqWind, d=sc.domain();
    const stops = d3.range(0,1.01,.25).map(t=>sc(d[0]+t*(d[1]-d[0]))).join(',');
    el.innerHTML=`<div class="ttl">${layer==='solar'?'Solar PV capacity factor':'Wind capacity factor, net'}</div><div class="ramp" style="background:linear-gradient(90deg,${stops})"></div><div class="ramp-l"><span>${d[0].toFixed(2)}</span><span>${d[1].toFixed(2)}</span></div>`;
  } else if(layer==='tier'){
    el.innerHTML=`<div class="ttl">Model coverage</div><div class="sw"><span><i style="background:var(--good)"></i>Screening + hourly + PyPSA</span><span><i style="background:#2c3a58"></i>Screening only</span><span><i style="background:var(--ink);border-radius:50%"></i>Tier B sample site</span></div>`;
  } else {
    el.innerHTML=`<div class="ttl">Street map only</div><div>Energy layers hidden. Pick a layer above to bring them back.</div>`;
  }
}

document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{
  layer=b.dataset.layer; document.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed', c===b));
  $('rail').scrollTop = 0;
  applyLayerVisibility(); update();
}));
function setSpin(on){ spinning=on; $('spin').textContent= on?'Pause spin':'Spin'; $('spin').setAttribute('aria-pressed',on); }
$('spin').addEventListener('click',()=>setSpin(!spinning));
$('home').addEventListener('click',()=>{
  if(selectedCell){ select(selectedId,false,null); }
  map.flyTo({center:[map.getCenter().lng,20], zoom:1.6, duration:reduceMotion?0:1500});
});

$('weights').innerHTML = CRITERIA.map(c=>`<div class="slider"><label for="w-${c}">${CRIT_LABEL[c]}</label><output id="ow-${c}">${weights[c]}</output><input type="range" id="w-${c}" min="0" max="5" step="1" value="${weights[c]}"></div>`).join('');
CRITERIA.forEach(c=>$('w-'+c).addEventListener('input',e=>{weights[c]=+e.target.value; $('ow-'+c).textContent=weights[c]; scheduleUpdate();}));

/* ---------- Tier B dispatch chart (illustrative) ---------- */
const dc = $('dispatch'), dx = dc.getContext('2d');
function profiles(){
  const R=lastR, sc = Object.fromEntries(lastRows.map(r=>[r.k,r.score]));
  const solarCap = 1.8*(sc.solar||0)*R.solarCF/.15, windCap = .8*Math.max(sc.onshore||0, sc.offshore||0)*Math.max(R.windCF,R.offCF||0)/.4;
  const P=[]; let soc=0;
  for(let h=0;h<24;h+=.25){
    const demand = .78 + .16*Math.sin((h-7)/24*2*Math.PI) + .1*Math.exp(-(((h-18.5)/1.8)**2));
    const sol = solarCap*Math.max(0,Math.sin(Math.PI*(h-6)/12))**1.3*.9;
    const wnd = windCap*(.55+.25*Math.sin(h/3.7+1.3)+.08*Math.sin(h*1.9));
    let bat=0;
    if(sol+wnd>demand){ soc += Math.min(sol+wnd-demand,.25)*.25; }
    else { bat=Math.min(demand-sol-wnd, soc/.25, .25); soc-=bat*.25; }
    const sUsed = Math.min(sol, demand), wUsed = Math.min(wnd, demand - sUsed);
    P.push({h,demand,sol:sUsed,wnd:wUsed,bat,firm:Math.max(0, demand - sUsed - wUsed - bat)});
  }
  const firmTech = lastRows.find(r=>['gas','nuclear','hydro','coal','diesel','biomass','geothermal','csp'].includes(r.k));
  return {P, firmKey: firmTech?firmTech.k:'gas'};
}
function drawDispatch(now){
  if(!lastR) return;
  const DPR=Math.min(2,devicePixelRatio||1), w=dc.clientWidth, h=dc.clientHeight; if(!w) return;
  if(dc.width!==Math.round(w*DPR)){ dc.width=Math.round(w*DPR); dc.height=Math.round(h*DPR); }
  dx.setTransform(DPR,0,0,DPR,0,0); dx.clearRect(0,0,w,h);
  const {P, firmKey} = profiles();
  const pad={l:26,r:6,t:6,b:18}, x=d3.scaleLinear([0,24],[pad.l,w-pad.r]), y=d3.scaleLinear([0,1.25],[h-pad.b,pad.t]);
  dx.strokeStyle=css('--line-soft'); dx.fillStyle=css('--ink-3'); dx.font='10px '+css('--f-mono'); dx.lineWidth=1;
  for(const v of [0,.5,1]){ dx.beginPath(); dx.moveTo(pad.l,y(v)); dx.lineTo(w-pad.r,y(v)); dx.stroke(); dx.fillText(v.toFixed(1),2,y(v)+3); }
  for(const t of [0,6,12,18,24]) dx.fillText(String(t).padStart(2,'0')+'h', Math.min(x(t)-8,w-26), h-4);
  let base=P.map(()=>0);
  for(const [k,col] of [['wnd',TECH.onshore.color],['sol',TECH.solar.color],['bat',css('--battery')],['firm',TECH[firmKey].color]]){
    dx.beginPath();
    P.forEach((p,i)=>{ const v=base[i]+p[k]; i?dx.lineTo(x(p.h),y(v)):dx.moveTo(x(p.h),y(v)); });
    for(let i=P.length-1;i>=0;i--) dx.lineTo(x(P[i].h),y(base[i]));
    dx.closePath(); dx.fillStyle=col; dx.globalAlpha=.85; dx.fill(); dx.globalAlpha=1;
    base=base.map((b,i)=>b+P[i][k]);
  }
  dx.beginPath(); P.forEach((p,i)=> i?dx.lineTo(x(p.h),y(p.demand)):dx.moveTo(x(p.h),y(p.demand))); dx.strokeStyle=css('--ink'); dx.setLineDash([3,3]); dx.stroke(); dx.setLineDash([]);
  const hr = reduceMotion ? 19 : ((now/450)%24), p = P[Math.min(P.length-1,Math.round(hr*4))];
  dx.beginPath(); dx.moveTo(x(hr),pad.t); dx.lineTo(x(hr),h-pad.b); dx.strokeStyle='rgba(230,236,246,.7)'; dx.stroke();
  const sum=p.sol+p.wnd+p.bat+p.firm||1;
  $('readout').innerHTML = `<span>${String(Math.floor(hr)).padStart(2,'0')}:${String(Math.floor((hr%1)*60)).padStart(2,'0')}</span>`+
    [['Wind',p.wnd,TECH.onshore.color],['Solar',p.sol,TECH.solar.color],['Storage',p.bat,css('--battery')],[TECH[firmKey].name,p.firm,TECH[firmKey].color]]
    .map(([n,v,c])=>`<span><i style="background:${c}"></i>${n} ${Math.round(v/sum*100)}%</span>`).join('')+`<span>- - demand</span>`;
}

/* boot */
regionDefaults(regionOf.get(selectedId));
update();
})();
