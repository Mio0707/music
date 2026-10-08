import test from 'node:test';
import assert from 'node:assert/strict';
import {initialArrangement,defaultSections,toggleTrack,scoreTaps,patternHits,normalizeArrangement,quantizeMelodyEvents,melodyFromScore} from '../src/domain.mjs';

test('defaults are independent per section',()=>{
 const d=defaultSections(),u=toggleTrack(d,0,'bear');
 assert.equal(d[0].bear,false);
 assert.equal(u[0].bear,true);
 assert.equal(u[1].bear,true);
});
test('expected rhythm includes repeated beats',()=>{
 const p={patternBeats:2,events:[{atBeat:0,action:'CLAP'},{atBeat:1,action:'CLAP'}]};
 assert.deepEqual(patternHits(p,2).map(e=>e.atBeat),[0,1,2,3]);
});
test('one tap cannot score multiple expected strikes',()=>{
 const s=scoreTaps([0,0.1,1],[0.05,1.02],0.12);
 assert.equal(s.hits,2);assert.equal(s.missed,1);assert.equal(s.extra,0);
});
test('melody quantizing retains pitches and clips note length',()=>{
 const e=quantizeMelodyEvents([{midi:60,atBeat:0.12,durationBeats:0.4},{midi:70,atBeat:8,durationBeats:1}]);
 assert.equal(e.length,1);assert.equal(e[0].midi,60);assert.equal(e[0].atBeat,0);
});
test('arrangement import validates kit and track controls',()=>{
 assert.throws(()=>normalizeArrangement({...initialArrangement(),kitId:'bogus'},['happy_bounce']));
 const x=normalizeArrangement(initialArrangement(),['happy_bounce']);
 assert.equal(x.sections.length,4);assert.equal(x.kitId,'happy_bounce');
});
test('melody excerpt normalizes to first note without changing data',()=>{
 const score={events:[{kind:'note',measureNumber:1,atBeat:10},{kind:'rest',measureNumber:2,atBeat:11},{kind:'note',measureNumber:5,atBeat:30}]};
 const res=melodyFromScore(score,4);
 assert.deepEqual(res.map(x=>x.atBeat),[0,1]);assert.equal(score.events[0].atBeat,10);
});
