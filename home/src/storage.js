const DB_NAME='animal-band-home-v1',VERSION=1;
export function openDatabase(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in globalThis))return reject(Error('当前浏览器不支持本地作品保存'));
  const request=indexedDB.open(DB_NAME,VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('works'))db.createObjectStore('works',{keyPath:'id'});
   if(!db.objectStoreNames.contains('recordings'))db.createObjectStore('recordings',{keyPath:'id'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
async function query(store,mode,requestFactory){
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode),object=tx.objectStore(store);
  const request=requestFactory(object);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
  tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);
 });
}
export function saveWork(work){return query('works','readwrite',o=>o.put(work));}
export function getWorks(){return query('works','readonly',o=>o.getAll());}
export function deleteWork(id){return query('works','readwrite',o=>o.delete(id));}
export function saveRecording(blob,meta){
 const item={id:meta.id,createdAt:meta.createdAt,songId:meta.songId,title:meta.title,blob,mimeType:blob.type};
 return query('recordings','readwrite',o=>o.put(item));
}
export function getRecordings(){return query('recordings','readonly',o=>o.getAll());}
export function deleteRecording(id){return query('recordings','readwrite',o=>o.delete(id));}
