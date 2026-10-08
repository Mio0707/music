export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const BEATS_PER_BAR=4;
export const noteNames=['do','re','mi','fa','sol','la','si','do'];
export const midiNotes=[60,62,64,65,67,69,71,72];
export const noteLabels=['1','2','3','4','5','6','7','1̇'];
export const TRACKS=['dog','bear','cat','lion'];

export function defaultSections(){
 return [
  {dog:true,bear:false,cat:false,lion:false},
  {dog:true,bear:true,cat:true,lion:false},
  {dog:true,bear:true,cat:true,lion:true},
  {dog:false,bear:true,cat:true,lion:false}
 ];
}
export function initialArrangement(kitId='happy_bounce'){
 return {kitId,sections:defaultSections(),melody:[],title:'我的动物乐队'};
}
export function toggleTrack(sections,sectionIndex,animalId){
 if(!TRACKS.includes(animalId))throw Error('Invalid animal');
 if(!Number.isInteger(sectionIndex)||sectionIndex<0||sectionIndex>=sections.length)throw Error('Invalid section');
 return sections.map((row,i)=>i===sectionIndex?{...row,[animalId]:!row[animalId]}:{...row});
}
export function normalizeArrangement(arrangement,allowedKits){
 if(!arrangement || !allowedKits.includes(arrangement.kitId)||!Array.isArray(arrangement.sections)||arrangement.sections.length!==4)throw Error('Invalid arrangement');
 const sections=arrangement.sections.map(row=>{
  const dst={};for(const animal of TRACKS)dst[animal]=row[animal]===true;
  return dst;
 });
 const melody=Array.isArray(arrangement.melody)?arrangement.melody.filter(e=>Number.isInteger(e.midi)&&e.midi>=0&&e.midi<=127&&Number.isFinite(e.atBeat)&&e.atBeat>=0&&e.atBeat<8&&Number.isFinite(e.durationBeats)&&e.durationBeats>0).slice(0,200):[];
 return {kitId:arrangement.kitId,sections,melody,title:String(arrangement.title||'我的动物乐队').slice(0,48)};
}
export function melodyFromScore(scoreTimeline,maxMeasures=4){
 const valid=scoreTimeline.events.filter(e=>e.kind==='note'||e.kind==='rest').filter(e=>e.measureNumber<=maxMeasures);
 if(!valid.length)return [];
 const origin=Math.min(...valid.map(e=>e.atBeat));
 return valid.map(e=>({...e,atBeat:e.atBeat-origin}));
}
export function patternHits(pattern,repeatCount=2){
 const p=pattern.patternBeats;
 if(!Array.isArray(pattern.events)||!Number.isFinite(p)||p<=0)throw Error('Invalid pattern');
 const hits=[];
 for(let r=0;r<repeatCount;r++)for(const e of pattern.events){
  if(e.atBeat>=0&&e.atBeat<p)hits.push({atBeat:r*p+e.atBeat,action:e.action||'CLAP'});
 }
 return hits;
}
/** Greedy 1-to-1 score matching; one tap cannot count twice. */
export function scoreTaps(expectedBeats,actualBeats,tolerance=0.32){
 const missed=[],matched=[],used=new Set();
 for(const expected of expectedBeats){
  let best=-1,distance=Infinity;
  for(let i=0;i<actualBeats.length;i++){
   if(used.has(i))continue;
   const d=Math.abs(expected-actualBeats[i]);
   if(d<distance){distance=d;best=i;}
  }
  if(best>=0&&distance<=tolerance){matched.push({expected,tapped:actualBeats[best],error:distance});used.add(best);}
  else missed.push(expected);
 }
 const total=expectedBeats.length;
 return {total,hits:matched.length,missed:missed.length,extra:actualBeats.length-used.size,accuracy:total?Math.round(matched.length/total*100):0,matched};
}
export function quantizeMelodyEvents(events,grid=0.25){
 return events.filter(x=>Number.isInteger(x.midi)).map(e=>({
  midi:e.midi,atBeat:clamp(Math.round(e.atBeat/grid)*grid,0,7.75),
  durationBeats:clamp(Math.max(grid,Math.round(e.durationBeats/grid)*grid),grid,8),
 })).filter(e=>e.atBeat+e.durationBeats<=8.001);
}
