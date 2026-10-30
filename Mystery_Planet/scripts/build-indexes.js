import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {config} from '../config.js';
import {openDatabase} from '../store.js';
export async function buildIndexes(target){
 const db=await openDatabase(target);
 try{if(db.dialect==='postgres'){
  await db.exec("CREATE INDEX IF NOT EXISTS place_search ON places USING GIN(to_tsvector('simple',name||' '||aliases)); ANALYZE places;");
 }else await db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS place_search USING fts5(name,aliases,content='places',content_rowid='rowid',tokenize='unicode61 remove_diacritics 2'); INSERT INTO place_search(place_search) VALUES('rebuild'); DELETE FROM spatial; INSERT INTO spatial SELECT rowid,lon,lon,lat,lat FROM places;");
 }finally{await db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{await buildIndexes(config.databaseUrl||config.dbPath);console.log('Geography search indexes rebuilt.')}
 catch{console.error('Index build failed. Check database availability, capacity and permissions.');process.exitCode=1}
}
