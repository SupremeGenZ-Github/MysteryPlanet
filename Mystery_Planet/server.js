import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {config,ROOT} from './config.js';
import {openDatabase,imported,lockPlayer} from './store.js';
import {roundsFor} from './round-engine.js';
import {answerMatches,VERSION,score} from './public/core.js';
const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
class HttpError extends Error{constructor(status,message,code){super(message);this.status=status;this.code=code}}
export async function createApplication(options={}){
 const cfg={...config,...options};if(cfg.databaseUrl){cfg.mode='postgres';cfg.temporary=false}
 const db=await openDatabase(cfg.databaseUrl||cfg.dbPath),publicDir=resolve(ROOT,'public');
 function json(res,status,data,ctx={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(ctx.newCookie?{'Set-Cookie':`mp_guest=${ctx.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${cfg.secureCookie?'; Secure':''}`}:{})});res.end(JSON.stringify(data))}
 function guest(req){const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('mp_guest='))?.slice(9);const valid=/^[a-f0-9]{64}$/.test(token||''),actual=valid?token:randomBytes(32).toString('hex');return {token:actual,newCookie:!valid,player:createHash('sha256').update(actual).digest('hex')}}
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HttpError(415,'JSON required');if(Number(req.headers['content-length']||0)>100000)throw new HttpError(413,'Request too large');let total=0,parts=[];for await(const part of req){total+=part.length;if(total>100000)throw new HttpError(413,'Request too large');parts.push(part)}let parsed;try{parsed=JSON.parse(Buffer.concat(parts).toString())}catch{throw new HttpError(400,'Invalid JSON')};if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new HttpError(400,'A JSON object is required');return parsed}
 async function handler(req,res){let ctx={};try{
  const url=new URL(req.url,'http://localhost'),path=url.pathname,q=url.searchParams;
  if(path==='/healthz'){try{await db.ping()}catch{throw new HttpError(503,'Database temporarily unavailable','DATABASE_UNAVAILABLE')}return json(res,200,{status:'ok'})}
  if(!path.startsWith('/api/')){
   if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Method not allowed');
   let relative;try{relative=decodeURIComponent(path)}catch{throw new HttpError(400,'Invalid path')}
   const file=resolve(publicDir,'.'+(relative==='/'?'/index.html':relative));
   if(!file.startsWith(publicDir+sep))throw new HttpError(404,'Not found');
   let info;try{info=await stat(file)}catch{throw new HttpError(404,'Not found')}
   if(!info.isFile())throw new HttpError(404,'Not found');
   res.writeHead(200,{'Content-Type':TYPES[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':extname(file)==='.geojson'?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'});
   if(req.method==='HEAD')return res.end();createReadStream(file).on('error',()=>res.destroy()).pipe(res);return;
  }
  ctx=guest(req);
  if(req.method==='GET'){
   if(path==='/api/health'){const full=await imported(db);return json(res,200,{ok:true,serverScoring:true,databaseBackend:db.dialect,contentVersion:VERSION,databaseImported:full,gazetteerAvailable:full,deploymentMode:cfg.mode,progressStorage:cfg.temporary?'browser':'browser-and-server',serverSessionsTemporary:cfg.temporary,mapillaryClientToken:cfg.mapillaryToken},ctx)}
   if(path==='/api/progress'){const row=await db.prepare('SELECT data FROM progress WHERE player=?').get(ctx.player);return json(res,200,row?JSON.parse(row.data):{},ctx)}
   if(path==='/api/coverage'){const report=await db.prepare('SELECT data FROM reports WHERE id=?').get('coverage');const full=await imported(db);return json(res,200,report?JSON.parse(report.data):{imported:full,mode:full?'imported-gazetteer':'bundled-starter'},ctx)}
   if(path==='/api/search'){
    if(!await imported(db))throw new HttpError(409,'Worldwide search is not installed on this service. The bundled country, region and city lists remain available.','GAZETTEER_NOT_IMPORTED');
    const kind=q.get('kind')||'city',text=(q.get('q')||'').trim().slice(0,160),cc=q.get('country'),parent=q.get('parent');
    const cursor=Math.max(0,Number(q.get('cursor')||0)),limit=Math.max(1,Math.min(100,Number(q.get('limit')||30)));
    if(!['city','region'].includes(kind)||!Number.isSafeInteger(cursor)||!Number.isInteger(limit))throw new HttpError(400,'Invalid search parameters');
    let where=['p.kind=?','p.rowid>?'],params=[kind,cursor];
    if(cc){where.push('p.country=?');params.push(cc)}else if(q.get('countries')){const codes=q.get('countries').split(',').filter(c=>/^[A-Z]{2}$/.test(c));if(codes.length){where.push('p.country IN ('+codes.map(()=>'?').join(',')+')');params.push(...codes)}}
    if(parent){where.push('p.parent_id=?');params.push(parent)}
    if(text){if(db.dialect==='sqlite'&&await db.prepare("SELECT 1 FROM sqlite_master WHERE name='place_search'").get()){where.push('p.rowid IN (SELECT rowid FROM place_search WHERE place_search MATCH ?)');params.push(text.split(/\s+/).map(t=>'"'+t.replaceAll('"','""')+'"*').join(' AND '))}else{where.push(db.dialect==='postgres'?"(to_tsvector('simple',p.name||' '||p.aliases) @@ plainto_tsquery('simple',?) OR lower(p.name) LIKE lower(?) ESCAPE '!')":"p.name LIKE ? ESCAPE '!'");const prefix=text.replace(/[!%_]/g,c=>'!'+c)+'%';if(db.dialect==='postgres')params.push(text,prefix);else params.push(prefix)}}
    const records=await db.prepare('SELECT p.rowid,p.* FROM places p WHERE '+where.join(' AND ')+' ORDER BY p.rowid LIMIT ?').all(...params,limit+1);
    const results=await Promise.all(records.slice(0,limit).map(async p=>{const par=p.parent_id?await db.prepare('SELECT name FROM places WHERE id=?').get(p.parent_id):null;return {id:p.id,name:p.name,kind:p.kind,countryCode:p.country,lat:p.lat,lon:p.lon,aliases:p.aliases.split(' | '),parent:p.parent_id,parentName:par?.name||'Intermediate administrative link unverified',timezone:p.timezone,feature:p.feature,source:'https://www.geonames.org/'+p.source_id,sourceDate:p.modified,clueReady:false}}));
    return json(res,200,{results,nextCursor:records.length>limit?records[limit-1].rowid:null,source:'GeoNames allCountries; all eligible records, no population threshold'},ctx);
   }
   if(path.startsWith('/api/place/')){const row=await db.prepare('SELECT * FROM places WHERE id=?').get(decodeURIComponent(path.slice(11)));if(!row)throw new HttpError(404,'Place not found');return json(res,200,row,ctx)}
   throw new HttpError(404,'Not found');
  }
  if(req.method!=='POST')throw new HttpError(405,'Method not allowed');
  const origin=req.headers.origin;if(origin){let same=false;try{same=new URL(origin).host===req.headers.host||origin.replace(/\/$/,'')===cfg.origin}catch{}if(!same)throw new HttpError(403,'Same-origin requests required')}
  const input=await body(req);
  if(path==='/api/match'){
   const spec={level:input.level||'country',pool:input.pool||'world',theme:input.theme||'all',count:Math.min(10,Math.max(1,Number(input.count)||5)),daily:!!input.daily,timed:!!input.timed};
   if(!['country','region','city','mixed'].includes(spec.level)||typeof spec.pool!=='string'||!Number.isInteger(spec.count))throw new HttpError(400,'Invalid match options');
   const rounds=roundsFor(spec);if(!rounds.length)throw new HttpError(422,'No clue-ready places in this pool.');
   const ids=[];
   await db.transaction(async tx=>{for(const round of rounds){const id=randomBytes(24).toString('hex');await tx.prepare('INSERT INTO rounds(id,player,answer,created,hints,finished) VALUES(?,?,?,0,1,0)').run(id,ctx.player,JSON.stringify(round));ids.push(id)}});
   return json(res,200,{rounds:ids,version:VERSION},ctx);
  }
  if(['/api/round','/api/hint','/api/answer'].includes(path)){
   if(typeof input.id!=='string')throw new HttpError(400,'Round ID required');
   const output=await db.transaction(async tx=>{
    const progress=await lockPlayer(tx,ctx.player);
    const row=await tx.prepare('SELECT * FROM rounds WHERE id=? AND player=?').get(input.id,ctx.player);
    if(!row)throw new HttpError(404,'This expedition session has expired. Start a new expedition; your browser passport is still saved.','ROUND_EXPIRED');
    const data=JSON.parse(row.answer),now=Math.floor(Date.now()/1000);
    if(path==='/api/round'){
     if(!row.created)await tx.prepare('UPDATE rounds SET created=? WHERE id=?').run(now,input.id);
     return {clues:data.clues.slice(0,row.hints),clueCount:data.clues.length,options:data.options,hints:row.hints,finished:!!row.finished};
    }
    if(path==='/api/hint'){
     if(row.finished)throw new HttpError(409,'Round already answered');
     const hints=Math.min(row.hints+1,data.clues.length);
     await tx.prepare('UPDATE rounds SET hints=? WHERE id=?').run(hints,input.id);
     return {clues:data.clues.slice(0,hints),clueCount:data.clues.length,hints};
    }
    if(row.finished)return JSON.parse(row.result);
    if(!row.created)throw new HttpError(409,'Open the round first');
    const guess=typeof input.guess==='string'?input.guess.slice(0,512):'',expired=!!data.timed&&now-row.created>65;
    const correct=!expired&&(guess===data.place.id||answerMatches(data.place,guess)),points=score(row.hints,correct),result={place:data.place,clues:data.clues,correct,points,expired};
    await tx.prepare('UPDATE rounds SET finished=1,result=? WHERE id=?').run(JSON.stringify(result),input.id);
    const stats=JSON.parse(progress.data);stats.xp+=correct?100+Math.round(points/100):20;stats.completed++;stats.learned[data.place.id]={name:data.place.name,correct};
    await tx.prepare('UPDATE progress SET data=?,updated=? WHERE player=?').run(JSON.stringify(stats),new Date().toISOString(),ctx.player);
    return result;
   });
   return json(res,200,output,ctx);
  }
  throw new HttpError(404,'Not found');
 }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'The request could not be completed. Please retry.',...(error.code&&error.status?{code:error.code}:{})},ctx);else res.destroy()}}
 const server=createServer(handler);server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,db,config:cfg,close:async()=>{await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));await db.close()}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const app=await createApplication();app.server.listen(config.port,config.host,()=>console.log('Mystery Planet listening on '+config.host+':'+config.port+' ('+config.mode+')'));
 const stop=()=>{app.close().then(()=>process.exit(0),()=>process.exit(1));setTimeout(()=>process.exit(1),10000).unref()};process.on('SIGTERM',stop);process.on('SIGINT',stop);
 }catch{console.error('Startup failed. Check DATABASE_URL, database availability and access permissions. Credentials are never logged.');process.exitCode=1}
}
