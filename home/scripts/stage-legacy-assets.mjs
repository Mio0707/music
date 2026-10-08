/* Copy only required preview assets (no duplicate checked-in WAV files).
 * The built home app uses data/core from their canonical repositories,
 * while preview sounds/stickers originate from the original music prototype. */
import {mkdir,copyFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HOME=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ROOT=path.resolve(HOME,'../prototype/assets');
const OUT=path.join(HOME,'public/generated');
const packs=['happy_bounce','calm_sway','brave_forward','longing_steady'];
const names=['dog','bear','cat','lion'];
const art=['avatar-dog.png','avatar-bear.png','avatar-cat.png','avatar-lion.png','home-feel.png','home-create.png'];
let copied=0;
async function copy(rel, destRel){
 const src=path.resolve(ROOT,rel),dest=path.join(OUT,destRel);
 try {await access(src);}catch{throw Error('Required legacy asset missing: '+src)}
 await mkdir(path.dirname(dest),{recursive:true});
 await copyFile(src,dest);copied++;
}
for(const file of art)await copy('stickers/'+file,'stickers/'+file);
for(const kit of packs)for(const animal of names)
 await copy('music/'+kit+'/v01/stems/'+animal+'.wav','music/'+kit+'/v01/stems/'+animal+'.wav');
console.log('Staged '+copied+' original legacy assets (generated, not source-controlled)');
