import {createReadStream,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import {basename,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import yauzl from 'yauzl';
import {config} from '../config.js';
import {openDatabase} from '../store.js';
export async function sourceStream(path){
 if(!path.toLowerCase().endsWith('.zip'))return {stream:createReadStream(path),close(){}};
 const zip=await new Promise((ok,no)=>yauzl.open(path,{lazyEntries:true,autoClose:false,validateEntrySizes:true},(err,z)=>err?no(err):ok(z)));
 try{return await new Promise((ok,no)=>{zip.on('error',no);zip.on('end',()=>no(Error('allCountries.txt not found in ZIP')));zip.on('entry',entry=>{if(entry.fileName==='allCountries.txt')zip.openReadStream(entry,(err,stream)=>err?no(err):ok({stream,close:()=>zip.close()}));else zip.readEntry()});zip.readEntry()})}catch(e){zip.close();throw e}
}
async function digest(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex')}
export async function ingest(source,target,{checkpoint=20000,log=()=>{}}={}){
 const sha=await digest(source),db=await openDatabase(target);
 try{const prior=await db.prepare('SELECT * FROM imports WHERE sha=?').get(sha);
 if(prior?.finished){return {alreadyImported:true,sha256:sha}}
 const start=prior?.line||0,date=new Date().toISOString().slice(0,10);
 await db.prepare('INSERT INTO sources(id,name,url,license,snapshot_date,sha256) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(sha,'GeoNames allCountries','https://download.geonames.org/export/dump/allCountries.zip','CC BY 4.0',date,sha);
 await db.prepare('INSERT INTO imports(sha,source,date,line,finished) VALUES(?,?,?,0,0) ON CONFLICT(sha) DO NOTHING').run(sha,basename(source),date);
 const insertSql=`INSERT INTO places(id,source_id,name,aliases,country,kind,admin_level,feature,lat,lon,parent_key,admin_key,timezone,modified,snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,aliases=excluded.aliases,country=excluded.country,kind=excluded.kind,admin_level=excluded.admin_level,feature=excluded.feature,lat=excluded.lat,lon=excluded.lon,parent_key=excluded.parent_key,admin_key=excluded.admin_key,timezone=excluded.timezone,modified=excluded.modified,snapshot=excluded.snapshot`;
 let line=0,accepted=0,pending=[];const {stream,close}=await sourceStream(source);
 async function flush(){await db.transaction(async tx=>{const insert=tx.prepare(insertSql);for(const row of pending)await insert.run(...row);await tx.prepare('UPDATE imports SET line=? WHERE sha=?').run(line,sha)});pending=[]}
 try{for await(const text of createInterface({input:stream,crlfDelay:Infinity})){
  line++;if(line<=start)continue;const v=text.split('\t');if(v.length!==19)throw Error('Malformed source row '+line);
  const [gid,name,ascii,aliases,lat,lon,cls,feature,cc,,a1,a2,a3,a4,,,,timezone,modified]=v;
  if(cls==='P'||cls==='A'&&feature.startsWith('ADM')){
   const match=feature.match(/^ADM([1-4])/),level=match?Number(match[1]):0;let parts=[a1,a2,a3,a4].slice(0,level?level-1:4);while(parts.length&&!parts.at(-1))parts.pop();
   if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon)))throw Error('Invalid coordinates on row '+line);
   pending.push(['gn:'+gid,gid,name,[...new Set([name,ascii,...aliases.split(',')])].join(' | '),cc,cls==='A'?'region':'city',level,feature,Number(lat),Number(lon),[cc,...parts].join('.'),level?[cc,...[a1,a2,a3,a4].slice(0,level)].join('.'):null,timezone,modified,sha]);accepted++;
  }
  if(line%checkpoint===0){await flush();if(line%500000===0)log({sourceLines:line,acceptedThisRun:accepted})}
 }
 await flush();
 await db.prepare("UPDATE places SET parent_id=(SELECT CASE WHEN count(*)=1 THEN min(p.id) END FROM places p WHERE p.admin_key=places.parent_key AND p.kind='region' AND p.feature='ADM'||p.admin_level) WHERE snapshot=?").run(sha);
 await db.prepare('UPDATE imports SET finished=1 WHERE sha=?').run(sha);
 const counts=Object.fromEntries((await db.prepare('SELECT kind,count(*) AS n FROM places GROUP BY kind').all()).map(r=>[r.kind,Number(r.n)]));
 const report={snapshot_sha256:sha,source_lines:line,imported:counts,unresolved_parent_links:Number((await db.prepare("SELECT count(*) AS n FROM places WHERE parent_id IS NULL AND parent_key LIKE '%.%'").get()).n),source:'GeoNames allCountries',license:'CC BY 4.0',no_population_threshold:true,complete_source_snapshot_import:true,universal_world_completeness:false,parent_policy:'Exact uncompressed source path; unique current ADM only.'};
 await db.prepare('INSERT INTO reports(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run('coverage',JSON.stringify(report));
 if(db.dialect==='sqlite')writeFileSync(resolve(dirname(target),'coverage.json'),JSON.stringify(report,null,2));return report;
 }finally{stream.destroy();close()}
 }finally{await db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const source=process.argv[2];if(!source)throw Error('Source file required');console.log(JSON.stringify(await ingest(source,config.databaseUrl||config.dbPath,{log:console.log}),null,2))}
 catch{console.error('Import failed. Check the source file, DATABASE_URL or DATABASE_PATH, available capacity and database permissions. A committed checkpoint can be resumed.');process.exitCode=1}
}
