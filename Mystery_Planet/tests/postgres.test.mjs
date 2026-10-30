import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {configuration} from '../config.js';
import {createApplication} from '../server.js';
import {ingest} from '../scripts/import-geonames.js';
import {buildIndexes} from '../scripts/build-indexes.js';
import {auditDatabase} from '../scripts/audit-database.js';

// Supply a dedicated disposable PostgreSQL database. These tests create records
// with random anonymous identities and import a tiny fixture, never reset schemas.
const url=process.env.TEST_DATABASE_URL;
test('DATABASE_URL selects durable PostgreSQL and missing/invalid configuration fails clearly',()=>{
 const cfg=configuration({DATABASE_URL:'postgresql://test:test@localhost/test',APP_MODE:'render-free',RENDER:'true'});
 assert.equal(cfg.mode,'postgres');assert.equal(cfg.temporary,false);assert.equal(cfg.secureCookie,true);
 assert.throws(()=>configuration({APP_MODE:'postgres'}),/DATABASE_URL/);
 assert.throws(()=>configuration({DATABASE_URL:'https://wrong.example'}),/PostgreSQL/);
});
async function start(){
 const app=await createApplication({databaseUrl:url,mode:'postgres',temporary:false,secureCookie:false,mapillaryToken:'public-qa-token'});
 await new Promise(ok=>app.server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+app.server.address().port;
 let cookie='';
 return {app,get cookie(){return cookie},set cookie(v){cookie=v},async request(path,data){
  const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
  const text=await r.text();return {status:r.status,data:JSON.parse(text),text};
 }};
}
test('PostgreSQL: bootstrap, all clue levels, concurrent scoring, server restart and rollback',{skip:!url},async()=>{
 let s=await start(),other;
 try{
  const h=await s.request('/api/health');assert.equal(h.status,200);assert.equal(h.data.databaseBackend,'postgres');assert.equal(h.data.serverSessionsTemporary,false);assert.equal(h.data.progressStorage,'browser-and-server');assert.equal(h.data.mapillaryClientToken,'public-qa-token');assert.ok(!h.text.includes(url));
  assert.equal((await s.request('/healthz')).status,200);
  const ping=s.app.db.ping;s.app.db.ping=()=>{throw Error('private-database-detail')};const outage=await s.request('/healthz');assert.equal(outage.status,503);assert.ok(!outage.text.includes('private-database-detail'));s.app.db.ping=ping;
  for(const level of ['country','region','city','mixed']){
   const m=await s.request('/api/match',{level,count:1});assert.equal(m.status,200);
   assert.equal((await s.request('/api/round',{id:m.data.rounds[0]})).status,200);
  }
  const m=await s.request('/api/match',{level:'country',pool:'c:ind',count:2});assert.equal(m.status,200);const id=m.data.rounds[0],id2=(await s.request('/api/match',{level:'country',pool:'c:ind',count:1})).data.rounds[0];
  await s.request('/api/round',{id});await s.request('/api/round',{id:id2});
  await s.request('/api/hint',{id});
  // Two app instances use independent pools against the same PostgreSQL database.
  other=await start();other.cookie=s.cookie;
  const [a,b,c]=await Promise.all([s.request('/api/answer',{id,guess:'India',points:999999}),other.request('/api/answer',{id,guess:'India'}),other.request('/api/answer',{id:id2,guess:'India'})]);
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(c.status,200);assert.deepEqual(a.data,b.data);assert.equal(a.data.points,4250);assert.equal((await s.request('/api/progress')).data.completed,2);
  assert.equal((await s.request('/api/hint',{id})).status,409);
  const cookie=s.cookie;await s.app.close();s=null;await other.app.close();other=null;s=await start();s.cookie=cookie;
  assert.equal((await s.request('/api/progress')).data.completed,2);assert.equal((await s.request('/api/round',{id})).data.finished,true);
  const marker='qa-rollback-'+Date.now();
  await assert.rejects(s.app.db.transaction(async tx=>{await tx.prepare('INSERT INTO reports(id,data) VALUES(?,?)').run(marker,'{}');throw Error('intentional rollback')}));
  assert.equal(await s.app.db.prepare('SELECT data FROM reports WHERE id=?').get(marker),undefined);
  const expired=await s.request('/api/round',{id:'does-not-exist'});assert.equal(expired.data.code,'ROUND_EXPIRED');
 }finally{if(s)await s.app.close();if(other)await other.app.close()}
});
test('PostgreSQL: source import, exact parents, repeat import, indexes, search and stored reports',{skip:!url},async()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'mystery-pg-'));let s;
 try{
  const source=resolve(dir,'allCountries.txt');
  const row=(id,name,cls,code,a1='',a2='',aliases='')=>[id,name,name,aliases,'10','20',cls,code,'ZZ','',a1,a2,'','','0','','0','Etc/UTC','2026-10-30'].join('\t');
  writeFileSync(source,[row('991001','QA Province','A','ADM1','01'),row('991002','QA District','A','ADM2','01','02'),row('991003','QA Tiny village','P','PPL','01','02','చిన్న గ్రామం'),row('991004','QA Missing parent','P','PPL','01','99'),row('991005','QA Second village','P','PPL','01','02')].join('\n')+'\n');
  const report=await ingest(source,url,{checkpoint:2});assert.equal(report.no_population_threshold,true);
  assert.equal((await ingest(source,url)).alreadyImported,true);
  await buildIndexes(url);const audit=await auditDatabase(url);assert.ok(audit.byCountryCode.ZZ.populatedPlaces>=3);
  s=await start();
  const place=(await s.request('/api/place/gn%3A991003')).data;assert.equal(place.parent_id,'gn:991002');assert.ok(place.aliases.includes('చిన్న గ్రామం'));
  const search=await s.request('/api/search?kind=city&country=ZZ&q=QA&limit=1');assert.equal(search.status,200);assert.equal(search.data.results.length,1);assert.ok(search.data.nextCursor>0);
  const page=await s.request('/api/search?kind=city&country=ZZ&q=QA&limit=1&cursor='+search.data.nextCursor);assert.notEqual(page.data.results[0].id,search.data.results[0].id);
  const local=await s.request('/api/search?kind=city&country=ZZ&q='+encodeURIComponent('చిన్న'));assert.ok(local.data.results.some(p=>p.id==='gn:991003'));
  assert.equal((await s.request('/api/coverage')).data.snapshot_sha256,report.snapshot_sha256);
  assert.equal((await s.request('/api/search?q='+encodeURIComponent("' OR 1=1 --"))).status,200);
 }finally{if(s)await s.app.close();rmSync(dir,{recursive:true,force:true})}
});
