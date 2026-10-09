/* Build-time imports: the only canonical source for educational music JSON.
 * Github private package access is needed only when installing dependencies. */
import catalog from '@animal-band/data/catalog.json';
import song1 from '@animal-band/data/textbooks/renjiao/grade-1/upper/songs/pep22_g1a_yangwawa/verified-score.json';
import song2 from '@animal-band/data/textbooks/renjiao/grade-1/lower/songs/pep22_g1b_zhaopengyou/verified-score.json';
import song3 from '@animal-band/data/textbooks/renjiao/grade-1/lower/songs/pep22_g1b_yaolanqu/verified-score.json';

import rhythm1 from '@animal-band/data/exercises/rhythm/patterns/pat-01.metadata.json';
import rhythm2 from '@animal-band/data/exercises/rhythm/patterns/pat-02.metadata.json';
import rhythm3 from '@animal-band/data/exercises/rhythm/patterns/pat-03.metadata.json';

import happyScore from '@animal-band/data/creative-kits/packs/happy_bounce/v01/score.json';
import happyManifest from '@animal-band/data/creative-kits/packs/happy_bounce/v01/manifest.json';
import calmScore from '@animal-band/data/creative-kits/packs/calm_sway/v01/score.json';
import calmManifest from '@animal-band/data/creative-kits/packs/calm_sway/v01/manifest.json';
import braveScore from '@animal-band/data/creative-kits/packs/brave_forward/v01/score.json';
import braveManifest from '@animal-band/data/creative-kits/packs/brave_forward/v01/manifest.json';
import longingScore from '@animal-band/data/creative-kits/packs/longing_steady/v01/score.json';
import longingManifest from '@animal-band/data/creative-kits/packs/longing_steady/v01/manifest.json';

export {catalog};
export const songs=[song1,song2,song3].map(score=>({
  id:score.songId,title:score.title,bpm:score.bpm,
  grade:score.recognitionMetadata?.book||'小学音乐',score
}));
export const rhythmPatterns=[rhythm1,rhythm2,rhythm3].map((pattern,index)=>({
 id:pattern.materialId,title:['稳稳地拍','两种声音','轻快的节奏'][index],pattern
}));
export const kits=[
 {id:'happy_bounce',label:'快乐·跳跃',mood:'happy',score:happyScore,manifest:happyManifest},
 {id:'calm_sway',label:'温柔·摇摆',mood:'calm',score:calmScore,manifest:calmManifest},
 {id:'brave_forward',label:'勇敢·向前',mood:'brave',score:braveScore,manifest:braveManifest},
 {id:'longing_steady',label:'思念·平稳',mood:'longing',score:longingScore,manifest:longingManifest}
];
const BASE=import.meta.env.BASE_URL;
export const animals=[
 {id:'dog',label:'小狗',role:'鼓点',img:BASE+'generated/stickers/avatar-dog.png',accent:'#FFD692'},
 {id:'bear',label:'小熊',role:'键盘与主旋律',img:BASE+'generated/stickers/avatar-bear.png',accent:'#D9E7B8'},
 {id:'cat',label:'小猫',role:'贝斯',img:BASE+'generated/stickers/avatar-cat.png',accent:'#E1D5FF'},
 {id:'lion',label:'狮子',role:'回应旋律',img:BASE+'generated/stickers/avatar-lion.png',accent:'#FFD1C3'}
];
export const sections=['开场','第一段','第二段','结尾'];
