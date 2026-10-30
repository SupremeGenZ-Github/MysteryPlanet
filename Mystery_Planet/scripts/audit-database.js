import {writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {config} from '../config.js';
import {openDatabase} from '../store.js';
export async function auditDatabase(target){
 const db=await openDatabase(target),byCountryCode={};
 try{
  for(const p of await db.prepare('SELECT country,kind,admin_level,count(*) AS n FROM places GROUP BY country,kind,admin_level').all()){const r=byCountryCode[p.country]??={populatedPlaces:0,adminLevels:{},unresolvedParents:0};if(p.kind==='city')r.populatedPlaces+=Number(p.n);else r.adminLevels[p.admin_level]=Number(p.n)}
  for(const p of await db.prepare("SELECT country,count(*) AS n FROM places WHERE parent_id IS NULL AND parent_key LIKE '%.%' GROUP BY country").all()){if(byCountryCode[p.country])byCountryCode[p.country].unresolvedParents=Number(p.n)}
  const snapshot=await db.prepare('SELECT data FROM reports WHERE id=?').get('coverage');
  const report={source:'GeoNames allCountries',snapshot_report:snapshot?JSON.parse(snapshot.data):null,byCountryCode};
  await db.prepare('INSERT INTO reports(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run('country-coverage',JSON.stringify(report));
  if(db.dialect==='sqlite')writeFileSync(resolve(dirname(target),'full-coverage-by-country.json'),JSON.stringify(report,null,2));
  return report;
 }finally{await db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{await auditDatabase(config.databaseUrl||config.dbPath);console.log('Country coverage audit saved in the configured database.')}
 catch{console.error('Audit failed. Check database availability and permissions.');process.exitCode=1}
}
