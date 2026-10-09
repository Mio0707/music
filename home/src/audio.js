/* Audio engine for home MVP.
 * All JSON is supplied by @animal-band/data and timeline conversion by core.
 * Existing preview WAV stems are staged from music/prototype by scripts/stage-legacy-assets.mjs.
 */
import {midiToFrequency,beatsToSeconds} from '@animal-band/core';
import {melodyFromScore,patternHits,quantizeMelodyEvents} from './domain.mjs';
export class HomeAudio {
 constructor(){
  this.ctx=null;this.sources=[];this.timers=[];this.session=null;
  this.buffers=new Map();this.keys=new Map();this.capture=null;this.onCaptureComplete=null;
 }
 async context(){
  if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();
  await this.ctx.resume();return this.ctx;
 }
 timeout(callback,ms){const id=setTimeout(callback,ms);this.timers.push(id);return id;}
 clearTimers(){this.timers.forEach(clearTimeout);this.timers=[];}
 stop(){
  this.clearTimers();
  for(const source of this.sources){try{source.stop()}catch{/* already ended */}}
  this.sources=[];this.session=null;
  this.keys.forEach(({osc,gain})=>{try{osc.stop();gain.disconnect()}catch{}});this.keys.clear();
  this.capture=null;
 }
 tone(midi,at,duration=0.22,volume=0.11,type='sine'){
  const ctx=this.ctx;if(!ctx)return;
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=type;osc.frequency.value=midiToFrequency(midi);
  gain.gain.setValueAtTime(0.0001,at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001,volume),at+0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001,at+Math.max(0.05,duration));
  osc.connect(gain).connect(ctx.destination);osc.start(at);osc.stop(at+Math.max(.055,duration)+.015);
  this.sources.push(osc);
 }
 metronome(at,accent=false){
  this.tone(accent?82:76,at,.07,accent?.13:.06,'triangle');
 }
 async playSong(timeline,callback){
  this.stop();const ctx=await this.context();const bpm=timeline.bpm;
  const events=melodyFromScore(timeline,4).filter(e=>e.kind==='note');
  if(!events.length)throw Error('没有可以播放的旋律');
  const base=ctx.currentTime+.13;
  for(const e of events){
   const at=base+beatsToSeconds(e.atBeat,bpm);
   this.tone(e.midiNumber,at,Math.max(.08,beatsToSeconds(e.durationBeats,bpm)*.88));
  }
  const duration=Math.max(...events.map(x=>x.atBeat+x.durationBeats));
  this.session={type:'song',beginAt:base,bpm,durationBeats:duration};
  this.timeout(()=>{this.session=null;callback?.()},(base-ctx.currentTime+beatsToSeconds(duration,bpm))*1000+100);
 }
 async startRhythm(pattern,onFinished){
  this.stop();const ctx=await this.context();
  const bpm=pattern.bpm;const countIn=Number(pattern.countInBeats??2);
  const events=patternHits(pattern,2);const length=pattern.patternBeats*2;
  const base=ctx.currentTime+.22;
  for(let i=0;i<countIn+length;i++){
   this.metronome(base+beatsToSeconds(i,bpm),i%pattern.meter?.beats===0);
  }
  for(const e of events){
   this.tone(e.action==='STOMP'?48:e.action==='CLAP'?76:67,
     base+beatsToSeconds(countIn+e.atBeat,bpm),.09,.045,'square');
  }
  const end=countIn+length;
  this.session={type:'rhythm',beginAt:base,bpm,countIn,patternBeats:pattern.patternBeats,length,actual:[],expected:events.map(x=>x.atBeat)};
  this.timeout(()=>{const s=this.session;if(s?.type==='rhythm'){this.session=null;onFinished?.(s)}},(base-ctx.currentTime+beatsToSeconds(end,bpm))*1000+110);
  return this.session;
 }
 registerTap(){
  const s=this.session,ctx=this.ctx;
  if(!s||s.type!=='rhythm')return null;
  const beat=(ctx.currentTime-s.beginAt)*s.bpm/60-s.countIn;
  if(beat<-.15||beat>s.length+.1)return null;
  const clamped=Math.max(0,beat);
  s.actual.push(clamped);
  this.tone(82,ctx.currentTime+.01,.08,.12,'triangle');
  return clamped;
 }
 async buffer(url){
  if(this.buffers.has(url))return this.buffers.get(url);
  const ctx=await this.context();
  const request=await fetch(url);
  if(!request.ok)throw Error('预览音频无法加载：'+url);
  const decoded=await ctx.decodeAudioData(await request.arrayBuffer());
  this.buffers.set(url,decoded);return decoded;
 }
 async playBand(kit,arrangement,onFinished){
  this.stop();const ctx=await this.context();
  const bpm=kit.score.bpm,beatSeconds=60/bpm,bars=kit.score.bars;
  const unit=Number(kit.score.timeSignature.split('/')[1]),beats=Number(kit.score.timeSignature.split('/')[0]);
  const loopBeats=bars*beats*4/unit;
  const loopSeconds=loopBeats*beatSeconds;
  const needed=new Set();
  const names=['dog','bear','cat','lion'];
  for(const section of arrangement.sections)for(const animal of names)if(section[animal])needed.add(animal);
  const buff=Object.fromEntries(await Promise.all([...needed].map(async animal=>{
    const file=kit.manifest.stems?.[animal];
    if(!file)throw Error('缺少动物音轨 '+animal);
    const url=import.meta.env.BASE_URL+'generated/music/'+kit.id+'/v01/'+file;
    return [animal,await this.buffer(url)];
  })));
  const base=ctx.currentTime+.17;
  for(let i=0;i<arrangement.sections.length;i++){
   const section=arrangement.sections[i];
   for(const animal of names)if(section[animal]&&buff[animal]){
    const node=ctx.createBufferSource(),gain=ctx.createGain();
    node.buffer=buff[animal];gain.gain.value=Number(kit.manifest.stemGains?.[animal]??1);
    node.connect(gain).connect(ctx.destination);node.start(base+i*loopSeconds);
    this.sources.push(node);
   }
   for(const e of arrangement.melody||[]){
    const t=base+(i*loopBeats+e.atBeat)*beatSeconds;
    this.tone(e.midi,t,Math.max(.08,e.durationBeats*beatSeconds*.88),.085,'sine');
   }
  }
  this.session={type:'band',beginAt:base,bpm,durationBeats:arrangement.sections.length*loopBeats,loopBeats};
  this.timeout(()=>{this.session=null;onFinished?.()},(base-ctx.currentTime+loopSeconds*arrangement.sections.length)*1000+150);
 }
 async startMelodyCapture(bpm,onFinished){
  this.stop();const ctx=await this.context(),base=ctx.currentTime+.2;
  this.capture={beginAt:base,bpm,events:[]};this.onCaptureComplete=onFinished;
  for(let i=0;i<8;i++)this.metronome(base+beatsToSeconds(i,bpm),i%4===0);
  this.timeout(()=>this.finishMelodyCapture(),(base-ctx.currentTime+beatsToSeconds(8,bpm))*1000+70);
 }
 noteOn(midi){
  if(this.keys.has(midi))return;
  const ctx=this.ctx;if(!ctx)return;
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='sine';osc.frequency.value=midiToFrequency(midi);
  const at=ctx.currentTime;
  gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.15,at+.02);
  osc.connect(gain).connect(ctx.destination);osc.start(at);
  let beat=null;if(this.capture)beat=(at-this.capture.beginAt)*this.capture.bpm/60;
  this.keys.set(midi,{osc,gain,start:at,beat});
 }
 noteOff(midi){
  const key=this.keys.get(midi);if(!key)return;
  const at=this.ctx.currentTime;
  key.gain.gain.setTargetAtTime(.0001,at,.03);key.osc.stop(at+.12);
  this.keys.delete(midi);
  if(this.capture&&key.beat!==null&&key.beat>=0&&key.beat<8){
   const duration=Math.max(.12,(at-key.start)*this.capture.bpm/60);
   this.capture.events.push({midi,atBeat:key.beat,durationBeats:duration});
  }
 }
 finishMelodyCapture(){
  if(!this.capture)return [];
  for(const note of [...this.keys.keys()])this.noteOff(note);
  const events=quantizeMelodyEvents(this.capture.events);
  const cb=this.onCaptureComplete;
  this.clearTimers();this.capture=null;this.onCaptureComplete=null;
  cb?.(events);return events;
 }
 get elapsedBeats(){
  const s=this.session;
  return s&&this.ctx?(this.ctx.currentTime-s.beginAt)*s.bpm/60:0;
 }
}
