/**
 * Standalone asset staging: no local sibling repository required.
 * Pin all legacy source bytes to a Git commit and their Git blob hash.
 * Prefer verified local source tree for migration development, else use public GitHub Raw.
 */
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(ROOT,'assets/legacy-source.json'),'utf8'));
const OUTPUT=path.join(ROOT,'public','generated');
const OLD_LOCAL=path.resolve(ROOT,'../prototype/assets');
const forceRemote=process.env.AB_FORCE_REMOTE_ASSETS==='1';
if(!/^[a-f0-9]{40}$/.test(manifest.ref))throw Error('Unsafe source Git reference');
const hash=(bytes)=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
function verify(bytes,item){
 if(bytes.length!==item.size||hash(bytes)!==item.gitBlobSha)throw Error('Source asset digest mismatch: '+item.relativePath);
}
let cached=0,local=0,remote=0;
for(const item of manifest.files){
 if(!/^(stickers|music)\/[a-zA-Z0-9_./-]+$/.test(item.relativePath)||item.relativePath.includes('..'))throw Error('Invalid asset path');
 const target=path.join(OUTPUT,item.relativePath);
 try{
   const b=await readFile(target);
   verify(b,item);cached++;continue;
 }catch(err){if(err.code!=='ENOENT'&&!String(err.message).includes('digest mismatch'))throw err;}
 let bytes;
 if(!forceRemote){
   try{bytes=await readFile(path.join(OLD_LOCAL,item.relativePath));verify(bytes,item);local++;}
   catch(e){if(e.code!=='ENOENT')throw e;bytes=null;}
 }
 if(!bytes){
   const url='https://raw.githubusercontent.com/'+manifest.origin+'/'+manifest.ref+'/prototype/assets/'+item.relativePath;
   const response=await fetch(url,{headers:{'User-Agent':'animal-band-home-build/0.1'}});
   if(!response.ok)throw Error('Cannot stage '+item.relativePath+': HTTP '+response.status);
   bytes=Buffer.from(await response.arrayBuffer());verify(bytes,item);remote++;
 }
 await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);
}
console.log('Staged '+manifest.files.length+' original legacy assets (cached='+cached+', local='+local+', remote='+remote+')');
