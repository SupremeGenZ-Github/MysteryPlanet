import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {random,shuffle,dailySeed,cluesFor} from './public/core.js';
let catalog;
export function loadCatalog(){return catalog??=Object.fromEntries(['countries','regions','cities'].map(k=>[k,JSON.parse(readFileSync(new URL('./public/data/'+k+'.json',import.meta.url),'utf8'))]))}
export function roundsFor(spec){
 const {countries,regions,cities}=loadCatalog();
 const country=p=>countries.find(c=>c.id===p.country)||p;
 const labels={'africa':'Africa','asia':'Asia','europe':'Europe','north-america':'North America','south-america':'South America','oceania':'Oceania','antarctica':'Antarctica'};
 let pool=spec.level==='mixed'?[...countries,...regions,...cities]:spec.level==='country'?countries:spec.level==='city'?cities:regions;
 pool=pool.filter(p=>p.clueReady);
 if(spec.pool.startsWith('c:'))pool=pool.filter(p=>country(p).id===spec.pool.slice(2));else if(spec.pool!=='world')pool=pool.filter(p=>country(p).continent===labels[spec.pool]||['rus','tur','kaz','geo','aze','arm'].includes(country(p).id)&&['europe','asia'].includes(spec.pool));
 if(spec.daily)pool=countries.filter(p=>p.clueReady);
 if(spec.theme==='islands'){const islands=new Set(['jpn','isl','mdg','lka','nzl','cyp','mlt','cub','jam','fji','mdv','mus','brb','sgp','phl','idn','gbr','irl','hti','dom','bhs','bhr','grd','dma','lca','vct','stp','cpv','com','syc','kir','ton','tuv','nru','plw','wsm','vut','mhl','fsm']);pool=pool.filter(p=>islands.has(country(p).id))}
 const r=random(spec.daily?dailySeed():randomUUID()),picks=shuffle(pool,r).slice(0,spec.daily?5:spec.count);
 return picks.map(place=>({place,clues:cluesFor(place,countries),options:shuffle([place,...shuffle(pool.filter(p=>p.id!==place.id),r).slice(0,3)],r).map(p=>({id:p.id,name:p.name,country:p.country,kind:p.kind})),timed:spec.timed}));
}
