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
  biomass: {name:'Biomass',       color:css('--biomass'), capex:3000, fom:90,  vom:6,  life:25, learn:0,     cf:.75, eff:.32, ef:.05,  fuel:'bio', crit:{emissions:.70,reliability:.85,land:.25,water:.45,jobs:.80,security:.70,access:.60}},
  battery: {name:'Battery storage (4h)', color:css('--battery'), capex:1000, fom:20, vom:0, life:15, learn:0.035, cf:.20, crit:{emissions:.90,reliability:.75,land:.95,water:.95,jobs:.50,security:.70,access:.80}}
};
// Starting values, so the assumptions editor can reset them
const TECH_DEFAULTS = Object.fromEntries(Object.entries(TECH).map(([k,t])=>[k,{capex:t.capex,fom:t.fom,life:t.life}]));
const TECH_SOURCE = {solar:'DESNZ 2023 (UK)', onshore:'DESNZ 2023 (UK)', offshore:'DESNZ 2023 (UK)', gas:'DESNZ 2023 (UK)'};
// [construction job-years per MW, permanent O&M jobs per MW]. Placeholder factors.
const JOBS = {solar:[13,.3],onshore:[8,.4],offshore:[12,.5],csp:[15,.8],gas:[3,.15],coal:[6,.3],diesel:[2,.2],nuclear:[12,.6],hydro:[10,.3],geothermal:[10,.5],biomass:[9,1.5],battery:[4,.1]};
const GEO = new Set([352,404,360,608,554,484,840,380,792,392,231,222,188,152,320,558]);
const CRITERIA = ['cost','emissions','reliability','land','water','jobs','security','access'];
const CRIT_LABEL = {cost:'Cost',emissions:'Emissions',reliability:'Reliability',land:'Land',water:'Water',jobs:'Jobs',security:'Security',access:'Access'};
const SHORT = {cost:'Cost',emissions:'CO₂',reliability:'Firm',land:'Land',water:'Water',jobs:'Jobs',security:'Secur.',access:'Access'};
const weights = {cost:3,emissions:2,reliability:2,land:1,water:1,jobs:1,security:1,access:1};

/* ---------- regions ---------- */
const REGIONS = {
  826:{name:'United Kingdom', tier:'c', solarCF:.111, windCF:.401, offCF:.48, hydroCF:null, geoCF:null, wacc:6,  carbon:80, gas:35, coal:12, oil:55, bio:22, gasSec:.40, nuclear:true, baseEF:.365, twh:40, local:40, demand:290, city:'Leeds',
       hist:{y2000:375, y2024:290, m2000:{coal:.32,gas:.39,nuclear:.22,onshore:.01,hydro:.02,biomass:.02,diesel:.02}, m2024:{gas:.32,offshore:.16,onshore:.14,nuclear:.14,biomass:.11,solar:.05,hydro:.02,coal:.01,battery:.01,diesel:.04}},
       real:{solar:true,onshore:true,offshore:true,gas:true},
       sub:'1 km cells · 241,997 km² land · 28.1% excluded (slope, density)',
       pypsa:{offshore:.37,onshore:.17,solar:.12,gas:.15,nuclear:.13,biomass:.06}},
  566:{name:'Nigeria', tier:'c', solarCF:.19, windCF:.16, offCF:.30, hydroCF:.45, geoCF:null, wacc:12, carbon:0, gas:12, coal:10, oil:45, bio:14, gasSec:.80, nuclear:false, baseEF:.48, twh:30, local:30, demand:40, city:'Lagos',
       hist:{y2000:15, y2024:40, m2000:{gas:.62,hydro:.36,diesel:.02}, m2024:{gas:.74,hydro:.21,solar:.02,diesel:.03}},
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
    demand: Math.round(20+h*380), city: f.properties.name+' (sample city)',
    hist:{y2000:Math.round((20+h*380)*.62), y2024:Math.round(20+h*380), m2000:{coal:.35,gas:.25,hydro:.15,nuclear:.10,diesel:.15}, m2024:{coal:.28,gas:.27,hydro:.15,nuclear:.08,onshore:.08,solar:.07,diesel:.07}},
    sub:'Globe-wide coarse tier · placeholder resource from latitude', pypsa:null};
}

/* ---------- economics: precomputed physics, live economics ---------- */
const S = {year:2025,wacc:6,carbon:80,gas:35,firm:40,twh:40,local:40,elec:22,growth:1,learn:1};
// Scenario presets. Values are styled on the named published scenarios, not taken from them.
const PRESETS = {
  steps: {label:'Stated policies', src:'styled on IEA WEO STEPS', year:2035, carbon:60, gas:30, elec:30, growth:1.0, firm:40, learn:1},
  nze:   {label:'Net zero 2050', src:'styled on IEA NZE', year:2040, carbon:180, gas:25, elec:52, growth:2.2, firm:60, learn:1.2},
  irena: {label:'1.5 °C pathway', src:'styled on IRENA WETO 1.5 °C', year:2050, carbon:150, gas:22, elec:65, growth:2.5, firm:70, learn:1.3},
  atb:   {label:'Cheap renewables', src:'styled on NREL ATB advanced', year:2040, carbon:40, gas:35, elec:38, growth:1.5, firm:40, learn:1.8},
  shock: {label:'Fossil price shock', src:'styled on the 2022 gas crisis', year:2030, carbon:90, gas:85, elec:28, growth:0.8, firm:40, learn:1}
};
let preset = 'custom';
// Electricity demand: grows each year, plus extra load as heating and transport electrify
const elecFactor = y => 1 + (S.elec-22)/100*2.2*Math.min(1,Math.max(0,(y-2024)/26));
const demandAt = (R,y) => R.demand*Math.pow(1+S.growth/100, Math.max(0,y-2024))*elecFactor(y);
const crf = (r,n)=> r===0 ? 1/n : r*(1+r)**n/((1+r)**n-1);
function cfOf(k,R){
  switch(k){
    case 'solar': return R.solarCF; case 'onshore': return R.windCF; case 'offshore': return R.offCF;
    case 'hydro': return R.hydroCF; case 'geothermal': return R.geoCF;
    case 'csp': return R.solarCF>=.17 ? Math.min(.6,R.solarCF*2.3) : null;
    default: return TECH[k].cf;
  }
}
const capexAt = (k,mult=1)=> TECH[k].capex*mult*Math.pow(1-TECH[k].learn*S.learn, S.year-2025);
function lcoe(key, R, capexMult=1){
  const t = TECH[key]; const r = S.wacc/100;
  const cf = cfOf(key,R); if(!cf) return null;
  let v = (capexAt(key,capexMult)*crf(r,t.life)+t.fom)/(8.76*cf) + t.vom;
  if(t.fuel){ const price = t.fuel==='gas' ? S.gas : R[t.fuel]; v += price/t.eff + S.carbon*t.ef; }
  if(key==='nuclear') v += 6;
  if(key==='battery'){ // pays for the cheap wind or solar it stores, with 85% round-trip efficiency
    const vre = ['solar','onshore'].map(k=>lcoe(k,R)).filter(x=>x!=null); v += (vre.length?Math.min(...vre):60)/.85; }
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
const GRID_NODES = {
  London:[-0.13,51.51], Bristol:[-2.59,51.45], Cardiff:[-3.18,51.48], Birmingham:[-1.9,52.48], Manchester:[-2.24,53.48], Leeds:[-1.55,53.8],
  Newcastle:[-1.61,54.97], Glasgow:[-4.25,55.86], Edinburgh:[-3.19,55.95], Aberdeen:[-2.1,57.15], Inverness:[-4.22,57.48], Norwich:[1.3,52.63], Belfast:[-5.93,54.6],
  Lagos:[3.38,6.52], Ibadan:[3.9,7.38], Abuja:[7.49,9.07], Kaduna:[7.44,10.52], Kano:[8.52,12.0], Jos:[8.89,9.9], Enugu:[7.5,6.45], 'Port Harcourt':[7.03,4.82],
  Maiduguri:[13.15,11.83], Kainji:[4.6,9.86], Benin:[5.62,6.34]
};
const GRID_EDGES = [['London','Birmingham'],['London','Bristol'],['Bristol','Cardiff'],['London','Norwich'],['Birmingham','Manchester'],['Birmingham','Leeds'],['Manchester','Leeds'],
  ['Leeds','Newcastle'],['Manchester','Glasgow'],['Newcastle','Edinburgh'],['Glasgow','Edinburgh'],['Edinburgh','Aberdeen'],['Aberdeen','Inverness'],['Glasgow','Inverness'],['Glasgow','Belfast'],
  ['Lagos','Ibadan'],['Lagos','Benin'],['Ibadan','Kainji'],['Kainji','Abuja'],['Abuja','Kaduna'],['Kaduna','Kano'],['Abuja','Jos'],['Jos','Maiduguri'],['Kano','Maiduguri'],['Benin','Enugu'],['Enugu','Port Harcourt'],['Benin','Port Harcourt'],['Enugu','Abuja']];
const GRID = {type:'FeatureCollection', features:[
  ...GRID_EDGES.map(([a,b])=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[GRID_NODES[a],GRID_NODES[b]]}})),
  ...Object.entries(GRID_NODES).map(([n,p])=>({type:'Feature',properties:{n},geometry:{type:'Point',coordinates:p}}))]};
let showGrid = false;
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
  // illustrative high-voltage grid (the real app would take this from OpenStreetMap power lines)
  map.addSource('grid',{type:'geojson', data:GRID});
  map.addLayer({id:'grid-line', type:'line', source:'grid', filter:['==',['geometry-type'],'LineString'], layout:{visibility:'none','line-cap':'round'},
    paint:{'line-color':'#e7b44c','line-width':['interpolate',['linear'],['zoom'],3,.8,8,2.4,12,3.5],'line-opacity':.85,'line-dasharray':[2,1.2]}});
  map.addLayer({id:'grid-node', type:'circle', source:'grid', filter:['==',['geometry-type'],'Point'], layout:{visibility:'none'},
    paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,2,8,4.5],'circle-color':'#0b1220','circle-stroke-color':'#e7b44c','circle-stroke-width':1.5}});
  map.addLayer({id:'countries-sel', type:'line', source:'countries', filter:['==',['get','id'],selectedId], paint:{'line-color':'#e6ecf6','line-width':1.6,'line-opacity':['interpolate',['linear'],['zoom'],5,1,8,.3]}});
  // Tier B sample sites as HTML markers so the pulse is a CSS animation, not a per-frame style change
  tierB.forEach(p=>{ const el=document.createElement('div'); el.className='tierb'; el.title='Tier B sample site (hourly model, not yet run)'; new maplibregl.Marker({element:el}).setLngLat(p).addTo(map); });
  ready=true; applyLayerVisibility(); update();
});

function applyLayerVisibility(){
  if(!ready) return;
  ['grid-line','grid-node'].forEach(l=>map.setLayoutProperty(l,'visibility',showGrid?'visible':'none'));
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
const sliders = {year:$('s-year'),wacc:$('s-wacc'),carbon:$('s-carbon'),gas:$('s-gas'),firm:$('s-firm'),twh:$('s-twh'),local:$('s-local'),elec:$('s-elec'),growth:$('s-growth')};
const fmt = {year:v=>v, wacc:v=>(+v).toFixed(1)+'%', carbon:v=>'£'+v+'/t', gas:v=>'£'+v+'/MWh', firm:v=>v+'%', twh:v=>v+' TWh/yr', local:v=>v+'%',
  elec:v=>v+'% of energy', growth:v=>(v>0?'+':'')+(+v).toFixed(1)+'%/yr'};
// New build = demand growth to the build year plus replacing 30% of today's fleet (a rough retirement allowance)
let twhManual = false;
const newBuildFor = R => Math.max(5, Math.round((demandAt(R,S.year) - R.demand + .3*R.demand)/5)*5);
function syncNewBuild(R){ if(twhManual) return; S.twh = Math.min(+sliders.twh.max, newBuildFor(R)); sliders.twh.value=S.twh; $('o-twh').textContent=fmt.twh(S.twh); }
function setPreset(key){
  preset = key; $('s-preset').value = key;
  const p = PRESETS[key];
  $('preset-src').textContent = p ? `${p.src}. Values are illustrative.` : 'Move any slider to make your own.';
  if(p){ for(const k of ['year','carbon','gas','elec','growth','firm']) S[k]=p[k]; S.learn=p.learn; twhManual=false; syncOutputs(); }
}
$('s-preset').addEventListener('change', e=>{ setPreset(e.target.value); if(e.target.value==='custom') S.learn=1; scheduleUpdate(); });
function renderDemand(R){
  const now=R.demand, then=demandAt(R,S.year);
  $('demand').innerHTML = `<span>Demand ${S.year}</span><b>${n0(then)} TWh</b><span class="muted">today ${n0(now)} TWh · ${then>=now?'+':''}${Math.round((then/now-1)*100)}%</span>`;
}
function syncOutputs(){ for(const k in sliders){ sliders[k].value=S[k]; $('o-'+k).textContent=fmt[k](S[k]); } }
for(const k in sliders) sliders[k].addEventListener('input',()=>{
  S[k]=+sliders[k].value; $('o-'+k).textContent=fmt[k](S[k]);
  if(k==='twh') twhManual=true;
  if(!['twh','local'].includes(k) && preset!=='custom') setPreset('custom');
  scheduleUpdate();
});
function regionDefaults(R){
  S.wacc=R.wacc; S.local=R.local; twhManual=false;
  if(preset==='custom'){ S.carbon=R.carbon; S.gas=R.gas; }
  syncOutputs();
}
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
  lastScr = scr;
  syncNewBuild(R); renderDemand(R);
  economics(R, scr);
  renderTab(R);
  legend();
  if(city && cityOpen) pushCity();
  if(!$('drawer').hidden && drawerTab==='assume') renderDrawer();
}
let lastScr = {};

/* ---------- Layer 3: history and projection ---------- */
// Mix shares for any year: history interpolates 2000 to 2024, projection eases from
// the 2024 mix toward the screening mix, faster with a higher carbon price.
function mixAt(R, y, target=lastScr){
  const H = R.hist, lerpMix=(a,b,t)=>{ const o={}; new Set([...Object.keys(a),...Object.keys(b)]).forEach(k=>{ o[k]=(a[k]||0)*(1-t)+(b[k]||0)*t; }); return o; };
  if(y<=2024) return lerpMix(H.m2000, H.m2024, Math.max(0,(y-2000)/24));
  const pace = .55 + S.carbon/220 + (S.learn-1)*.3, t = Math.min(1, ((y-2024)/26)*pace), e = 1-Math.pow(1-t,2);
  const m = lerpMix(H.m2024, target, e), sum = Object.values(m).reduce((a,b)=>a+b,0)||1;
  for(const k in m) m[k]/=sum; return m;
}
const totalAt = (R,y)=> y<=2024 ? R.hist.y2000+(R.hist.y2024-R.hist.y2000)*Math.max(0,(y-2000)/24) : demandAt(R,y);
function drawHistory(R){
  const c=$('history'), DPR=Math.min(2,devicePixelRatio||1), w=c.clientWidth, h=c.clientHeight; if(!w) return;
  c.width=Math.round(w*DPR); c.height=Math.round(h*DPR); const g=c.getContext('2d'); g.setTransform(DPR,0,0,DPR,0,0);
  const years=d3.range(2000,2051), data=years.map(y=>({y, tot:totalAt(R,y), m:mixAt(R,y)}));
  const keys = TECH_KEYS.filter(k=>data.some(d=>(d.m[k]||0)>.004));
  const pad={l:34,r:8,t:10,b:18}, x=d3.scaleLinear([2000,2050],[pad.l,w-pad.r]), ymax=d3.max(data,d=>d.tot)*1.08, y=d3.scaleLinear([0,ymax],[h-pad.b,pad.t]);
  g.font='10px '+css('--f-mono'); g.fillStyle=css('--ink-3'); g.strokeStyle=css('--line-soft');
  y.ticks(4).forEach(v=>{ g.beginPath(); g.moveTo(pad.l,y(v)); g.lineTo(w-pad.r,y(v)); g.stroke(); g.fillText(n0(v),2,y(v)+3); });
  [2000,2010,2024,2035,2050].forEach(t=>g.fillText(t,Math.min(x(t)-12,w-30),h-4));
  // projection area slightly lighter so history and scenario read differently
  let base=data.map(()=>0);
  for(const k of keys){
    g.beginPath(); data.forEach((d,i)=>{ const v=base[i]+(d.m[k]||0)*d.tot; i?g.lineTo(x(d.y),y(v)):g.moveTo(x(d.y),y(v)); });
    for(let i=data.length-1;i>=0;i--) g.lineTo(x(data[i].y),y(base[i]));
    g.closePath(); g.fillStyle=TECH[k].color; g.globalAlpha=.85; g.fill(); g.globalAlpha=1;
    base=base.map((b,i)=>b+(data[i].m[k]||0)*data[i].tot);
  }
  g.fillStyle='rgba(11,18,32,.28)'; g.fillRect(x(2024),pad.t,x(2050)-x(2024),h-pad.b-pad.t);
  const vline=(yr,label,col)=>{ g.strokeStyle=col; g.setLineDash([3,3]); g.beginPath(); g.moveTo(x(yr),pad.t); g.lineTo(x(yr),h-pad.b); g.stroke(); g.setLineDash([]); g.fillStyle=col; g.fillText(label,Math.min(x(yr)+3,w-60),pad.t+9); };
  vline(2024,'today',css('--ink-2')); if(S.year>2024) vline(S.year,String(S.year),css('--ink'));
  $('history-legend').innerHTML = keys.map(k=>`<span><i style="background:${TECH[k].color}"></i>${TECH[k].name}</span>`).join('');
  const sel = data.find(d=>d.y===S.year), low = ['solar','onshore','offshore','csp','nuclear','hydro','geothermal','biomass','battery'].reduce((s,k)=>s+(sel.m[k]||0),0);
  $('history-src').textContent = `${S.year}: ${n0(sel.tot)} TWh, ${Math.round(low*100)}% low-carbon. History styled on Ember yearly data. The projection eases from today's mix toward the screening mix, faster with a higher carbon price, with demand from your growth and electrification sliders. ${PRESETS[preset]?'Scenario '+PRESETS[preset].label+', '+PRESETS[preset].src+'.':''}`;
}

/* ---------- Layer 4: mock background optimisation ---------- */
const RUN = {status:'idle', pct:0, log:[], result:null, id:null, timer:null, scen:''};
const scenKey = ()=> JSON.stringify([S.year,S.carbon,S.gas,S.wacc,S.firm,S.elec,S.growth,S.learn]);
function startRun(){
  const R = regionOf.get(selectedId), full = R.tier==='c';
  const steps = full ? [
    'Loading OpenStreetMap network: 412 buses, 607 lines','Clustering to 30 nodes','Attaching ERA5 wind and solar profiles, 8,760 hours',
    'Adding 12 carriers, storage and interconnectors','Building linear program: 1.9 million variables','Solving with HiGHS (interior point)','Writing results to JSON'] : [
    'Loading ERA5 hourly weather for this site','Building one-node network','Adding wind, solar, storage and firm backup','Solving with HiGHS','Writing results'];
  clearInterval(RUN.timer);
  Object.assign(RUN,{status:'running',pct:0,log:[],result:null,id:selectedId,name:R.name,full,scen:scenKey()});
  let i=0, sub=0;
  RUN.timer = setInterval(()=>{
    sub++;
    if(sub===1 && steps[i]) RUN.log.push(steps[i]);
    if(steps[i] && steps[i].startsWith('Solving') && sub<6) RUN.log.push(`  iteration ${sub*7}: gap ${(Math.pow(10,-sub)).toExponential(0)}`);
    if(sub>=(steps[i]&&steps[i].startsWith('Solving')?6:2)){ i++; sub=0; }
    RUN.pct = Math.min(100, Math.round(i/steps.length*100));
    if(i>=steps.length){ clearInterval(RUN.timer); RUN.status='done'; RUN.result=runResult(R); RUN.log.push(`Done. Objective £${n1(RUN.result.costBn)}bn/yr (mock)`); }
    renderRunPill(); if(layer==='tier') renderRun();
  }, 450);
  renderRunPill(); renderRun();
}
function runResult(R){
  // start from the region's mock PyPSA mix (or screening for Tier B), then nudge it with the scenario
  let mix = {...(R.pypsa || lastScr)};
  const shift = Math.min(.6, S.carbon/300 + (S.gas-30)/200);
  const fossil = ['gas','coal','diesel'].reduce((s,k)=>s+(mix[k]||0),0), move = fossil*Math.max(0,shift);
  ['gas','coal','diesel'].forEach(k=>{ if(mix[k]) mix[k]*= (1-Math.max(0,shift)); });
  const clean = ['offshore','onshore','solar'].filter(k=>mix[k]!=null || available(R).includes(k));
  clean.forEach(k=>{ mix[k]=(mix[k]||0)+move/clean.length; });
  mix.battery = (mix.battery||0) + .02 + S.firm/2000;
  const sum=Object.values(mix).reduce((a,b)=>a+b,0); for(const k in mix) mix[k]/=sum;
  const twh = demandAt(R,S.year), cap = Object.fromEntries(Object.entries(mix).map(([k,s])=>[k, s*twh/(8.76*(cfOf(k,R)||.3))]));
  const avg = Object.entries(mix).reduce((s,[k,v])=>s+v*(lcoe(k,R)||80),0)*1.12;
  const vre = (mix.solar||0)+(mix.onshore||0)+(mix.offshore||0);
  return {mix, cap, twh, avg, costBn: avg*twh/1000, curtail: 2+vre*9, co2: Object.entries(mix).reduce((s,[k,v])=>s+v*(TECH[k].ef||0),0)*1000};
}
function renderRunPill(){
  const p=$('runpill');
  if(RUN.status==='idle'){ p.hidden=true; return; }
  p.hidden=false; p.className='runpill '+RUN.status;
  p.textContent = RUN.status==='running' ? `Optimisation running · ${RUN.pct}%` : `Optimisation done · ${RUN.name}`;
}
$('runpill').addEventListener('click',()=>{ if(RUN.id!=null && RUN.id!==selectedId) select(RUN.id,true); document.querySelector('.chip[data-layer="tier"]').click(); });
function renderRun(){
  const R = regionOf.get(selectedId), full = R.tier==='c', el=$('run');
  const mine = RUN.id===selectedId;
  let html = `<p class="note" style="margin-top:0">${full
    ? 'Runs a PyPSA-Earth capacity expansion and hourly dispatch for the whole country in the background, then compares it with the screening answer.'
    : 'Only the UK and Nigeria get a full regional model. Here you can run a one-node hourly model (Tier B) instead.'} You can keep using the map while it runs.</p>`;
  html += `<button class="runbtn" id="run-go" ${RUN.status==='running'?'disabled':''}>${RUN.status==='running'?'Running…':(mine&&RUN.status==='done'?'Run again with current scenario':(full?'Run PyPSA-Earth for '+R.name:'Run Tier B model'))}</button>`;
  if(mine && RUN.status!=='idle'){
    html += `<div class="prog"><div style="width:${RUN.pct}%"></div></div><pre class="log">${RUN.log.slice(-9).join('\n')}</pre>`;
  }
  if(mine && RUN.result){
    const r=RUN.result, stale = RUN.scen!==scenKey();
    const stack = mix => Object.entries(mix).filter(([,v])=>v>.004).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="flex-basis:${v*100}%;background:${TECH[k].color}" title="${TECH[k].name} ${Math.round(v*100)}%">${v>.09?Math.round(v*100)+'%':''}</div>`).join('');
    html += `${stale?'<p class="warnline">Scenario changed since this run. Run again to update.</p>':''}
      <div class="econ" style="margin-top:12px">
        <div><div class="k">System cost</div><div><span class="v">${Math.round(r.avg)}</span><span class="u">£/MWh</span></div></div>
        <div><div class="k">Annual cost</div><div><span class="v">${n1(r.costBn)}</span><span class="u">£bn</span></div></div>
        <div><div class="k">Carbon intensity</div><div><span class="v">${Math.round(r.co2)}</span><span class="u">g/kWh</span></div></div>
        <div><div class="k">Curtailment</div><div><span class="v">${n1(r.curtail)}</span><span class="u">%</span></div></div>
      </div>
      <div class="cmp">
        <div><div class="lbl"><span>Optimised mix, ${S.year}</span><span class="tier ph">mock result</span></div><div class="stack">${stack(r.mix)}</div></div>
        <div><div class="lbl"><span>Screening mix</span><span class="tier a">live</span></div><div class="stack">${stack(lastScr)}</div></div>
      </div>
      <ol class="toplist" style="margin-top:12px">${Object.entries(r.cap).filter(([,v])=>v>.05).sort((a,b)=>b[1]-a[1]).map(([k,v],i,arr)=>`<li><span class="n">${i+1}</span><span class="nm"><i style="background:${TECH[k].color}"></i>${TECH[k].name}</span><div class="b" style="width:${v/arr[0][1]*100}%;background:${TECH[k].color}"></div><span class="v">${n1(v)} GW</span></li>`).join('')}</ol>`;
  }
  el.innerHTML = html;
  $('run-go').onclick = startRun;
}

/* ---------- Layer 5: the same economics under each scenario ---------- */
function calcEcon(R, mix, twh, local){
  let gw=0, inv=0, jb=0, jo=0, ef=0; const jobsBy={}, invBy={};
  for(const [k,share] of Object.entries(mix)){
    const cap = share*twh/(8.76*cfOf(k,R)), i = capexAt(k)*cap/1000;
    gw+=cap; inv+=i; invBy[k]=i; jobsBy[k]=JOBS[k][0]*cap*1000; jb+=jobsBy[k]; jo+=JOBS[k][1]*cap*1000; ef += share*(TECH[k].ef||0);
  }
  return {gw, inv, jb, jo, jobsBy, invBy, gdp: inv*local/100*GDP_MULT, co2: twh*(R.baseEF-ef)};
}
function scenarioTable(R){
  const saved = {...S}, rows=[];
  const run = (key,label)=>{
    const ev = evaluate(R), top=ev.slice(0,5), tot=top.reduce((s,r)=>s+r.score**4,0), mix=Object.fromEntries(top.map(r=>[r.k,r.score**4/tot]));
    const e = calcEcon(R, mix, newBuildFor(R), S.local); rows.push({key,label,year:S.year,...e});
  };
  run('custom', preset==='custom' ? 'Your sliders' : 'Current');
  for(const [k,p] of Object.entries(PRESETS)){ Object.assign(S,{year:p.year,carbon:p.carbon,gas:p.gas,elec:p.elec,growth:p.growth,firm:p.firm,learn:p.learn}); run(k,p.label); Object.assign(S,saved); }
  $('scen-table').innerHTML = `<tr><th>Scenario</th><th>Year</th><th>Invest £bn</th><th>Build jobs</th><th>CO₂ Mt/yr</th></tr>` +
    rows.map(r=>`<tr data-p="${r.key}" class="${r.key===preset||(r.key==='custom'&&preset==='custom')?'on':''}"><td>${r.label}</td><td>${r.year}</td><td>${n1(r.inv)}</td><td>${d3.format('.2s')(r.jb)}</td><td>${n1(r.co2)}</td></tr>`).join('');
}
$('scen-table').addEventListener('click', e=>{ const tr=e.target.closest('tr[data-p]'); if(tr && tr.dataset.p!=='custom'){ setPreset(tr.dataset.p); scheduleUpdate(); } });

/* ---------- Data and assumptions drawer (Layer 1 transparency, Layer 2 rationale) ---------- */
let drawerTab='assume';
function openDrawer(){ $('drawer').hidden=false; renderDrawer(); }
$('open-drawer').addEventListener('click',()=>{ $('drawer').hidden ? openDrawer() : ($('drawer').hidden=true); });
$('close-drawer').addEventListener('click',()=>{ $('drawer').hidden=true; });
document.querySelectorAll('.drawer .tab').forEach(t=>t.addEventListener('click',()=>{ drawerTab=t.dataset.dtab; document.querySelectorAll('.drawer .tab').forEach(x=>x.setAttribute('aria-selected',x===t)); renderDrawer(); }));
const SOURCES = [
  ['Global Solar Atlas','Solar yield (PVOUT) per cell','Used for the UK in Layer 1','real'],
  ['Global Wind Atlas','Wind capacity factor per cell','Used for the UK in Layer 1','real'],
  ['Copernicus GLO-90','Elevation and slope exclusions','Used for the UK in Layer 1','real'],
  ['GHSL population','Density exclusions','Used for the UK in Layer 1','real'],
  ['DESNZ 2023 generation costs','UK capital and running costs','Used for the UK in Layer 1','real'],
  ['DUKES 2026','UK fleet load factors, validation','Used for the UK in Layer 1','real'],
  ['ERA5','Hourly weather for Tier B and C runs','Planned','plan'],
  ['WorldPop / GPW','Population outside the UK','Planned','plan'],
  ['OpenStreetMap power lines','Transmission grid','Planned (grid on the map is drawn by hand)','plan'],
  ['Ember','Historical generation mix','Planned (history chart is styled on it)','plan'],
  ['IEA WEO, IRENA WETO, NREL ATB','Scenario projections and cost paths','Planned (presets are styled on them)','plan'],
  ['World Bank, Our World in Data','Demand, GDP and economic baselines','Planned','plan'],
  ['IRENA jobs reports','Job multipliers for Layer 5','Planned (factors are placeholders)','plan']
];
function renderDrawer(){
  const body=$('drawer-body');
  if(drawerTab==='assume'){
    const R = lastR || regionOf.get(selectedId);
    body.innerHTML = `<p class="note" style="margin-top:0">Edit any number and the map, rankings and city update at once. Costs in 2023 £. Battery cost is per kW of a 4-hour system.</p>
      <div class="wrap-x"><table class="assume"><tr><th>Technology</th><th>Capital £/kW</th><th>Fixed O&amp;M £/kW·yr</th><th>Life yrs</th><th>LCOE here</th><th>Source</th></tr>
      ${TECH_KEYS.map(k=>{ const t=TECH[k], v=lcoe(k,R); return `<tr><td><i style="background:${t.color}"></i>${t.name}</td>
        <td><input type="number" data-k="${k}" data-f="capex" value="${t.capex}" min="50" step="50" aria-label="${t.name} capital cost"></td>
        <td><input type="number" data-k="${k}" data-f="fom" value="${t.fom}" min="0" step="1" aria-label="${t.name} fixed O&M"></td>
        <td><input type="number" data-k="${k}" data-f="life" value="${t.life}" min="5" max="80" step="1" aria-label="${t.name} life"></td>
        <td class="num">${v==null?'n/a':'£'+Math.round(v)}</td><td><span class="src ${TECH_SOURCE[k]?'real':''}">${TECH_SOURCE[k]||'placeholder'}</span></td></tr>`; }).join('')}
      </table></div><div class="row" style="margin-top:10px"><button class="link" id="reset-assume">Reset all to defaults</button></div>`;
    body.querySelectorAll('input[data-k]').forEach(inp=>inp.addEventListener('change',()=>{ const v=+inp.value; if(v>0){ TECH[inp.dataset.k][inp.dataset.f]=v; update(); } }));
    $('reset-assume').onclick=()=>{ for(const k in TECH_DEFAULTS) Object.assign(TECH[k],TECH_DEFAULTS[k]); update(); };
  } else if(drawerTab==='sources'){
    body.innerHTML = `<p class="note" style="margin-top:0">Every number in the finished app will trace back to one of these. Green means already used in the Layer 1 code.</p>
      <ol class="sitelist">${SOURCES.map(([n,what,st,c])=>`<li class="srcrow"><span><b>${n}</b><br><span class="muted">${what}</span></span><span class="tier ${c==='real'?'c':'ph'}">${st}</span></li>`).join('')}</ol>`;
  } else {
    body.innerHTML = `<div class="about"><p><b>MapLibre GL JS</b> draws the globe and the street map. It was picked over the alternatives for four reasons:</p>
      <ul><li>It is free and open source with no account or API key, so the site can be hosted for nothing on GitHub Pages.</li>
      <li>Version 5 has a real globe view that blends into a flat street map as you zoom.</li>
      <li>It reads vector tiles and plain GeoJSON straight from static files, which suits precomputed map layers.</li>
      <li>Colours are style expressions, so slider changes recolour thousands of cells without a server.</li></ul>
      <p><b>CesiumJS</b> is stronger for photorealistic terrain and 3D city tiles but is heavier than this needs. <b>deck.gl</b> can sit on top of MapLibre later if the cell layers need GPU tricks. <b>three.js</b> alone would mean rebuilding map tiling by hand, so it is used only for the city view.</p></div>`;
  }
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
  if(layer==='jobs'){ renderJobsTech(R); scenarioTable(R); }
  if(layer==='tier'){ renderTiers(R); renderRun(); }
  if(layer==='best') drawHistory(R);
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
  const {gw, inv, jb, jo, jobsBy, invBy, gdp, co2} = calcEcon(R, mix, S.twh, S.local);
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
  el.insertAdjacentHTML('beforeend', `<label class="gridtog"><input type="checkbox" id="grid-tog" ${showGrid?'checked':''}> Transmission grid <span class="muted">(illustrative, UK and Nigeria)</span></label>`);
}
$('legend').addEventListener('change', e=>{ if(e.target.id==='grid-tog'){ showGrid=e.target.checked; applyLayerVisibility(); } });

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

/* ---------- Layer 6: city view glue ---------- */
let city = null, cityOpen = false;
const CITY_LABEL = {onshore:'wind turbines', offshore:'offshore turbines', solar:'solar farms', csp:'solar towers', gas:'gas plants', coal:'coal plants', diesel:'diesel sets', nuclear:'nuclear stations', hydro:'dam', battery:'battery yards', biomass:'biomass plants', geothermal:'geothermal plants'};
function pushCity(){
  const R = regionOf.get(selectedId), mix = mixAt(R, S.year);
  city.setMix(mix);
  $('city-name').textContent = R.city;
  $('city-sub').textContent = `${R.name} · ${S.year} · ${PRESETS[preset]?PRESETS[preset].label:'custom scenario'}`;
  $('city-mix').innerHTML = Object.entries(mix).filter(([,v])=>v>.005).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="flex-basis:${v*100}%;background:${TECH[k].color}" title="${TECH[k].name} ${Math.round(v*100)}%">${v>.1?Math.round(v*100)+'%':''}</div>`).join('');
  const low = ['solar','onshore','offshore','csp','nuclear','hydro','geothermal','biomass','battery'].reduce((s,k)=>s+(mix[k]||0),0);
  const co2 = Object.entries(mix).reduce((s,[k,v])=>s+v*(TECH[k].ef||0),0)*1000;
  $('city-stats').innerHTML = [['Low-carbon',Math.round(low*100)+'%'],['Grid CO₂',Math.round(co2)+' g/kWh'],['Demand',n0(totalAt(R,S.year))+' TWh']]
    .map(([k,v])=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  const c = city.counts();
  $('city-legend').innerHTML = Object.entries(c).filter(([,n])=>n>0).map(([k,n])=>`<span><i style="background:${TECH[k].color}"></i>${n} ${CITY_LABEL[k]}</span>`).join('');
}
function setCity(open){
  cityOpen = open; $('city').hidden = !open; $('city-btn').setAttribute('aria-pressed', open); $('city-btn').textContent = open ? 'Map view' : 'City view';
  document.querySelector('.legend').hidden = open; document.querySelector('.stagebtns').hidden = open;
  if(open){
    if(!city){
      if(!window.THREE || !window.CityScene){ $('city-sub').textContent = 'The 3D library did not load. Check your connection and reload.'; return; }
      city = window.CityScene($('city-canvas'), {onTick:h=>{ $('city-clock').textContent = `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor((h%1)*60)).padStart(2,'0')}`; }});
    }
    setSpin(false); city.start(); pushCity();
  } else if(city) city.stop();
}
$('city-btn').addEventListener('click',()=>setCity(!cityOpen));
$('city-back').addEventListener('click',()=>setCity(false));
$('city-pause').addEventListener('click',e=>{ if(city) e.target.textContent = city.togglePause() ? 'Resume time' : 'Pause time'; });

/* boot */
regionDefaults(regionOf.get(selectedId));
update();
})();
