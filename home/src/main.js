import './style.css';
import {scoreToTimeline} from '@animal-band/core';
import {songs,rhythmPatterns,kits,animals,sections} from './content.js';
import {HomeAudio} from './audio.js';
import {initialArrangement,toggleTrack,scoreTaps,midiNotes,noteLabels,noteNames,normalizeArrangement} from './domain.mjs';
import {saveWork,getWorks,deleteWork,saveRecording,getRecordings,deleteRecording} from './storage.js';

const audio=new HomeAudio();
const S={page:'home',mode:'rhythm',song:0,pattern:0,kit:0,arrangement:initialArrangement(),playing:false,practicing:false,recordingMelody:false,rhythmResult:null,works:[],recordings:[],recorder:null,stream:null,recParts:[]};
const app=document.getElementById('app');
const activePointers=new Map();
let noticeTimer=null,recordingUrl=null;
const elt=(tag,props={},...children)=>{
 const x=document.createElement(tag);
 for(const [k,v] of Object.entries(props)){
  if(v==null)continue;
  if(k==='class')x.className=v;
  else if(k==='text')x.textContent=v;
  else if(k==='on')x.addEventListener('click',v);
  else if(k==='attrs')for(const [a,b] of Object.entries(v))x.setAttribute(a,String(b));
  else x[k]=v;
 }
 for(const y of children.flat(Infinity))if(y!=null&&y!==false)x.append(typeof y==='string'?document.createTextNode(y):y);
 return x;
};
const div=(cls,...c)=>elt('div',{class:cls},...c);
const t=(tag,content,cls='')=>elt(tag,{class:cls,text:content});
const p=(content,cls='')=>t('p',content,cls);
const img=(src,alt,cls='')=>elt('img',{src,alt,class:cls,loading:'lazy'});
const linked=(label,action,cls='button',attrs={})=>elt('button',{type:'button',class:cls,attrs,on:()=>run(action)},label);
function heading(eyebrow,title,subtitle){
 return elt('section',{class:'page-title'},
  t('span',eyebrow,'eyebrow'),t('h1',title),p(subtitle,'muted'));
}
function card(eyebrow,title,...contents){
 return div('panel',div('panel-heading',t('span',eyebrow,'eyebrow'),t('h2',title)),...contents);
}
function notice(msg){
 const el=document.getElementById('notice');
 el.textContent=msg;el.classList.add('visible');clearTimeout(noticeTimer);
 noticeTimer=setTimeout(()=>el.classList.remove('visible'),4300);
}
function go(next){
 if(S.recorder){notice('请先结束录音');return}
 audio.stop();S.playing=false;S.practicing=false;S.recordingMelody=false;
 S.page=next;show();window.scrollTo(0,0);
 if(next==='works')refreshWorks();
}
function nav(){
 const links=[['home','首页'],['learn','学音乐'],['band','玩乐队'],['works','我的作品']];
 return elt('header',{class:'topbar'},
  linked('♫ 动物乐队','home','brand'),
  div('nav-links',...links.map(([k,label])=>linked(label,k,'nav-link'+(S.page===k?' selected':'')))),
  t('span','家庭体验版 · v0.1','version'));
}
function home(){
 const hero=div('hero',
  div('hero-copy',t('span','MUSIC IS PLAY','eyebrow'),t('h1','每个孩子，都能拥有自己的动物乐队。'),
    p('先听一听，跟着拍一拍，再邀请动物伙伴一起演奏。没有音乐基础，也能从第一拍开始。'),
    div('actions',linked('开始学音乐 →','learn'),linked('直接玩乐队','band','button outline')),
    t('small','作品只保存在这台设备的浏览器里。','muted')),
  div('hero-animals',...animals.map((a,i)=>div('animal-bubble bubble-'+i,img(a.img,a.label,'avatar')))));
 const cards=div('choice-grid',
  elt('button',{class:'choice-card learn-choice',on:()=>go('learn')},
   div('choice-copy',t('small','01 / LEARN','eyebrow'),t('h2','学音乐'),p('听节奏、跟着拍、认音符、唱旋律。'),t('span','进入学音乐 ↗','choice-cta')),
   img('/generated/stickers/home-feel.png','动物音乐学习卡片')),
  elt('button',{class:'choice-card band-choice',on:()=>go('band')},
   div('choice-copy',t('small','02 / CREATE','eyebrow'),t('h2','玩乐队'),p('邀请四只动物，亲手编排属于自己的音乐。'),t('span','进入玩乐队 ↗','choice-cta')),
   img('/generated/stickers/home-create.png','动物乐队创作卡片')));
 return div('screen',hero,div('section-lead',t('h2','今天想怎么玩？'),p('两个入口都能直接开始，不需要先完成课程才能创作。')),cards,
  div('next-banner',div('',t('strong','有保存过的作品吗？'),p('从这台设备上继续上次的创作。')),linked('查看我的作品 →','works','button outline')));
}
function learnRhythm(){
 const item=rhythmPatterns[S.pattern],pattern=item.pattern;
 const slots=pattern.events.map((e,i)=>div('beat-card',
  t('small',String(i+1).padStart(2,'0'),'beat-counter'),
  t('span','♩','beat-symbol'),t('strong',e.actionLabel||e.action||'拍手'),t('small',String(e.durationBeats)+' 拍','muted')));
 const choices=div('pill-row',...rhythmPatterns.map((x,i)=>
  linked(x.title,()=>{audio.stop();S.pattern=i;S.practicing=false;S.rhythmResult=null;show()},'pill'+(S.pattern===i?' selected':''))));
 const result=S.rhythmResult;
 return card('01 · 节奏练习','先听，再拍节奏',
  p('听到预备拍后，跟着节奏点击“拍一下”。一次练习包含两遍节奏。','muted'),
  choices,div('beat-grid',...slots),
  div('actions',linked('▶ 听节奏并开始练习',async()=>{
    S.practicing=true;S.rhythmResult=null;show();
    await audio.startRhythm(pattern,session=>{
      S.practicing=false;S.rhythmResult=scoreTaps(session.expected,session.actual);show();
    });
   },'button'),elt('button',{class:'button tap-button',disabled:!S.practicing,on:()=>{const beat=audio.registerTap();if(beat!=null){const e=document.getElementById('live-status');if(e)e.textContent='记录了第 '+beat.toFixed(1)+' 拍的拍击';}}},'拍一下！')),
  t('p',S.practicing?'进行中：跟着声音拍击':result?'命中 '+result.hits+'/'+result.total+' 拍，正确率 '+result.accuracy+'%':'点击开始，先听预备拍','live-status'),
  result?div('result',t('strong',result.accuracy>=80?'你抓住节奏了！':result.accuracy>=50?'不错，再来一遍！':'再听一遍，找找节拍'),p('漏拍 '+result.missed+' · 多拍 '+result.extra)):null,
  p('节奏练习由共享音乐数据驱动；反馈仅比较拍击时间，不采集麦克风。','footnote'));
}
function learnMelody(){
 const x=songs[S.song],timeline=scoreToTimeline(x.score,{format:'verified-score'});
 const notes=timeline.events.filter(e=>e.kind==='note'&&e.measureNumber<=4).slice(0,40);
 const choices=div('song-choices',...songs.map((item,i)=>linked(item.title,()=>{audio.stop();S.song=i;show()},'song-choice'+(S.song===i?' selected':''))));
 return card('02 · 旋律与唱名','听一听，跟着唱',
  p('选择一首经核谱的教材歌曲，先听前四小节，再录下自己的演唱。','muted'),
  choices,div('song-meta',t('strong',x.title),t('small',x.grade+' · '+x.bpm+' BPM','muted')),
  div('solfege-grid',...notes.map(e=>div('solfege-chip',t('strong',e.solfege),t('small',e.lyric||'·')))),
  div('actions',linked('▶ 听旋律示范',async()=>{
    await audio.playSong(timeline,()=>notice('旋律播放完毕'));
    notice('正在播放前四小节：'+x.title);
   },'button'),
   linked(S.recorder?'■ 停止演唱录音':'● 录下我的演唱',()=>recordVoice(!S.recorder),'button outline')),
  t('p',S.recorder?'录音中……点击停止后自动存到我的作品':'示范为浏览器合成旋律，不是原唱；无需人声模型。','footnote'));
}
function learn(){
 return div('screen',heading('LEARN MUSIC','学音乐 · 从第一拍开始','先模仿，再探索；节奏和旋律学习都能独立体验。'),
  div('tabbar',linked('01 认识节奏',()=>{audio.stop();S.mode='rhythm';S.practicing=false;show()},'tab'+(S.mode==='rhythm'?' selected':'')),
   linked('02 旋律唱名',()=>{audio.stop();S.mode='melody';S.practicing=false;show()},'tab'+(S.mode==='melody'?' selected':''))),
  S.mode==='rhythm'?learnRhythm():learnMelody(),
  div('next-banner',div('',t('strong','准备好了，来组建乐队吧'),p('让小狗打鼓，小熊演奏旋律。')),linked('去玩乐队 →','band','button outline')));
}
function kitSelector(){
 return card('STEP 01','选择音乐',
  p('使用旧版 Demo 的真实分轨 WAV 音色，编曲结构从共享音乐包读取。','muted'),
  div('kit-grid',...kits.map((k,i)=>linked(k.label,()=>{
   audio.stop();S.playing=false;S.kit=i;S.arrangement.kitId=k.id;show();
  },'kit-choice'+(S.kit===i?' selected':'')))));
}
function arrangementPanel(){
 const rows=div('arrangement-rows');
 rows.append(div('arrangement-row track-head',t('strong','乐段','section-label'),
  ...animals.map(a=>div('track-animal',img(a.img,a.label),t('strong',a.label),t('small',a.role)))));
 for(let i=0;i<4;i++)rows.append(div('arrangement-row',div('section-label',t('small','0'+(i+1)),t('strong',sections[i])),
  ...animals.map(a=>{
   const on=S.arrangement.sections[i][a.id];
   return linked(on?'● 已加入':'○ 静音',()=>{
    S.arrangement.sections=toggleTrack(S.arrangement.sections,i,a.id);show();
   },'track-toggle'+(on?' on':''));
  })));
 return card('STEP 02','为每段安排动物',
  p('四段编曲，每段两小节。点击格子决定哪只动物在哪一段演奏。','muted'),rows,
  div('actions',linked(S.playing?'↻ 重新试听':'▶ 试听完整编曲',async()=>{
    S.playing=true;show();
    const kit=kits[S.kit];
    await audio.playBand(kit,S.arrangement,()=>{S.playing=false;show()});
  },'button'),elt('button',{class:'button outline',disabled:!S.playing,on:()=>{audio.stop();S.playing=false;show()}},'■ 停止')),
  p(S.playing?'四段编曲正在演奏……':'按时间轴依次播放原始动物音乐分轨。','live-status'));
}
function pianoPanel(){
 const keyRow=div('piano-keys');
 midiNotes.forEach((midi,i)=>{
  const key=elt('button',{type:'button',class:'piano-key',attrs:{'data-midi':midi,'aria-label':noteNames[i]+' 音'}},
    t('strong',noteLabels[i]),t('small',noteNames[i]));
  key.addEventListener('pointerdown',async event=>{
   event.preventDefault();
   key.setPointerCapture?.(event.pointerId);
   activePointers.set(event.pointerId,{key,midi});
   key.classList.add('down');await audio.context();
   if(activePointers.has(event.pointerId))audio.noteOn(midi);
  });
  const release=event=>{
   if(!activePointers.has(event.pointerId))return;
   activePointers.delete(event.pointerId);audio.noteOff(midi);key.classList.remove('down');
  };
  key.addEventListener('pointerup',release);key.addEventListener('pointercancel',release);
  keyRow.append(key);
 });
 return card('STEP 03','弹一段自己的旋律',
  p('8 个音符组成简易键盘。录两个小节，再放进动物编曲里。','muted'),keyRow,
  p(S.arrangement.melody.length?'已录制 '+S.arrangement.melody.length+' 个音符':'还没有录制旋律','melody-status'),
  div('actions',linked(S.recordingMelody?'■ 完成录制':'● 录两个小节',
    async()=>{
     if(S.recordingMelody){audio.finishMelodyCapture();return;}
     S.recordingMelody=true;show();
     await audio.startMelodyCapture(kits[S.kit].score.bpm,events=>{
      S.arrangement.melody=events;S.recordingMelody=false;show();
      notice(events.length?'旋律已加入作品':'没有录到音符，可以再试一次');
     });
    },'button'),linked('清空旋律',()=>{S.arrangement.melody=[];show()},'button outline')),
  S.recordingMelody?p('录制中：请跟着 8 拍节拍器演奏。','recording'):null);
}
function savePanel(){
 const input=elt('input',{type:'text',id:'work-title',maxLength:48,value:S.arrangement.title,placeholder:'例如：小熊的音乐会'});
 return card('STEP 04','保存作品',t('label','给作品起个名字'),input,
  p('作品包含每一段的动物开关与自己录制的音符，保存在当前浏览器。','muted'),
  linked('保存到我的作品 →',async()=>{
   S.arrangement.title=input.value.trim()||'我的动物乐队';
   const arrangement=normalizeArrangement(S.arrangement,kits.map(x=>x.id));
   await saveWork({id:crypto.randomUUID(),createdAt:new Date().toISOString(),schemaVersion:'home-work-v1',arrangement});
   notice('作品已保存');go('works');
  },'button wide'));
}
function band(){
 return div('screen',heading('PLAY IN A BAND','玩乐队 · 我的第一支乐队','选择音乐、安排动物、自己演奏，还可以保存作品。'),
 div('band-layout',div('band-primary',kitSelector(),arrangementPanel()),div('band-secondary',pianoPanel(),savePanel())));
}
function workCard(work){
 const title=work.arrangement?.title||'我的作品';
 return div('work-row',t('span','♫','work-icon'),div('work-desc',t('strong',title),t('small',new Date(work.createdAt).toLocaleString('zh-CN'),'muted')),
  div('work-buttons',linked('继续创作',()=>{
    S.arrangement=normalizeArrangement(work.arrangement,kits.map(x=>x.id));S.kit=kits.findIndex(x=>x.id===S.arrangement.kitId);go('band');
   },'small-button'),
   linked('导出 JSON',()=>{
    const blob=new Blob([JSON.stringify(work,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=elt('a',{href:url,download:'animal-band-work.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   },'small-button'),
   linked('删除',async()=>{if(!confirm('确认删除这份本地作品吗？'))return;await deleteWork(work.id);await refreshWorks();},'small-button danger')));
}
function recordingCard(rec){
 return div('work-row',t('span','●','work-icon mic'),div('work-desc',t('strong',rec.title),t('small',new Date(rec.createdAt).toLocaleString('zh-CN'),'muted')),
  div('work-buttons',linked('试听',()=>{
    const player=document.getElementById('recording-player');
    if(recordingUrl)URL.revokeObjectURL(recordingUrl);
    recordingUrl=URL.createObjectURL(rec.blob);player.src=recordingUrl;player.hidden=false;player.play().catch(e=>notice(e.message));
   },'small-button'),linked('删除',async()=>{
    if(!confirm('确认删除这段本地录音吗？'))return;
    await deleteRecording(rec.id);await refreshWorks();
   },'small-button danger')));
}
function works(){
 const audioPlayer=elt('audio',{id:'recording-player',controls:true,hidden:true,class:'player'});
 return div('screen',heading('MY CREATIONS','我的作品 · 音乐收藏夹','数据只保存在当前设备。清空浏览器数据可能导致作品丢失，请导出重要作品。'),
  card('MY WORKS','我的编曲 ('+S.works.length+')',S.works.length?S.works.map(workCard):div('empty',p('还没有编曲作品。'),linked('去玩乐队 →','band','button outline'))),
  card('MY VOICE','我的演唱 ('+S.recordings.length+')',
   S.recordings.length?S.recordings.map(recordingCard):div('empty',p('还没有演唱录音。'),linked('去学音乐 →','learn','button outline')),
   audioPlayer));
}
function show(){
 app.replaceChildren(nav(),elt('main',{class:'page'},S.page==='home'?home():S.page==='learn'?learn():S.page==='band'?band():works()),
  elt('footer',{class:'footer'},t('span','动物乐队 · 家庭体验版'),t('span','使用 animal-band-data 与 animal-band-core')));
}
function run(action){try{
 if(typeof action==='function')Promise.resolve(action()).catch(e=>{console.error(e);notice(e.message);S.playing=false;S.practicing=false;show()});
 else go(action);
}catch(e){console.error(e);notice(e.message)}}
async function refreshWorks(){
 try{
  const [a,b]=await Promise.all([getWorks(),getRecordings()]);
  S.works=a.sort((x,y)=>y.createdAt.localeCompare(x.createdAt));
  S.recordings=b.sort((x,y)=>y.createdAt.localeCompare(x.createdAt));
  if(S.page==='works')show();
 }catch(e){notice('本地存储不可用：'+e.message)}
}
async function recordVoice(start){
 if(!start){S.recorder?.stop();return;}
 if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia)throw Error('录音需要 HTTPS 或 localhost 下支持麦克风的浏览器');
 const stream=await navigator.mediaDevices.getUserMedia({audio:true});
 const rec=new MediaRecorder(stream);
 S.recorder=rec;S.stream=stream;S.recParts=[];
 const entry=songs[S.song];
 rec.ondataavailable=e=>{if(e.data.size)S.recParts.push(e.data)};
 rec.onstop=async()=>{
  stream.getTracks().forEach(track=>track.stop());
  const blob=new Blob(S.recParts,{type:rec.mimeType||'audio/webm'});
  S.recorder=null;S.stream=null;S.recParts=[];
  if(blob.size){
   try{await saveRecording(blob,{id:crypto.randomUUID(),songId:entry.id,title:entry.title+' · 我的演唱',createdAt:new Date().toISOString()});
    notice('录音已保存在「我的作品」');}
   catch(e){notice('录音保存失败：'+e.message)}
  }
  show();
 };
 rec.start();show();
}
window.addEventListener('pagehide',()=>{
 audio.stop();S.stream?.getTracks().forEach(t=>t.stop());
 if(recordingUrl)URL.revokeObjectURL(recordingUrl);
});
document.body.append(elt('div',{id:'notice',attrs:{role:'status','aria-live':'polite'}}));
show();
