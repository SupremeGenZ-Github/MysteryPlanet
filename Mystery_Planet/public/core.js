export const VERSION='2026.10.29-1';
export function normalize(s){return String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'')}
export function random(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
export function shuffle(a,r=Math.random){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function distance(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)))}
export function pointIn(geometry,[lon,lat]){if(!geometry)return false;const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;function ring(r){let inside=false;let previous=null;const pts=r.map(([x,y])=>{if(previous!==null){while(x-previous>180)x-=360;while(x-previous< -180)x+=360}previous=x;return [x,y]});let queryLon=lon,centre=pts.reduce((n,p)=>n+p[0],0)/pts.length;while(queryLon-centre>180)queryLon-=360;while(queryLon-centre< -180)queryLon+=360;for(let i=0,j=pts.length-1;i<pts.length;j=i++){let [x,y]=pts[i],[xx,yy]=pts[j];if((y>lat)!==(yy>lat)&&queryLon<(xx-x)*(lat-y)/(yy-y)+x)inside=!inside}return inside}return polys.some(p=>ring(p[0])&&!p.slice(1).some(ring))}
export function score(hints,correct,distanceKm=null){return correct?Math.round(5000*Math.max(.2,1-(hints-1)*.15)*(distanceKm===null?1:Math.exp(-distanceKm/2000))):0}
export function cluesFor(p,countries){let c=p.kind==='country'||p.kind==='territory'?p:countries.find(c=>c.id===p.country);let base=[];const add=(type,text,source=(p.source?.startsWith('http')?p.source:p.kind==='region'?(p.level===2?'https://www.geoboundaries.org/':'https://www.naturalearthdata.com/'):c?.source),scope=p.id)=>base.push({type,text,source,scope,verified:'source-backed template',snapshot:p.sourceDate||'2026-10-29'});
 if(p.kind==='country'||p.kind==='territory'){
  add('The big picture',`Look in ${p.continent}. This place lies mainly ${p.lat>=0?'north':'south'} of the equator.`);
  if(p.languages?.length)add('Listen closely',`Languages recorded here include ${p.languages.slice(0,3).map(l=>{try{return new Intl.DisplayNames(['en'],{type:'language'}).of(l.split('-')[0])}catch{return l}}).join(', ')}. These can include regional languages.`,p.source);
  if(p.currency)add('Pocket change',`The source records ${new Intl.DisplayNames(['en'],{type:'currency'}).of(p.currency)} (${p.currency}). Other places may use it too.`);
  if(p.neighbors?.length)add('Next door',`It borders ${p.neighbors.map(cc=>countries.find(c=>c.code===cc)?.name||cc).slice(0,4).join(', ')} according to the gazetteer.`);
  add('The final lead',`Its recorded capital is ${p.capital}. The English display name starts with “${p.name[0]}”.`);
 }else{
  add('The big picture',`This ${p.kind==='city'?'populated place':p.unit||'administrative region'} is in ${c?.name||'an unresolved country assignment'}.`);
  add('On the compass',`Its source ${p.kind==='city'?'location':'approximate boundary centre'} is around ${Math.abs(p.lat).toFixed(1)}° ${p.lat>=0?'N':'S'}, ${Math.abs(p.lon).toFixed(1)}° ${p.lon>=0?'E':'W'}.`);
  if(p.landmark)add('A familiar sight',p.landmark,p.factSource||p.source);
  if(p.timezone)add('Local time',`The gazetteer records the time zone ${p.timezone}. This is context, not a unique identifier.`);
  if(p.parentName)add('A closer look',`Its source parent is ${p.parentName}.`);
  add('Name detective',`The display name begins “${p.name.slice(0,2)}”, has ${[...p.name].length} characters, and ends “${p.name.slice(-2)}”.`);
 }
 return base;
}
export function answerMatches(p,input){return [p.name,...(p.aliases||[])].some(n=>normalize(n)===normalize(input))}
export function dayKey(){return new Date().toLocaleDateString('en-CA',{timeZone:'UTC'})}
export function dailySeed(day=dayKey()){return 'mystery-planet|'+VERSION+'|'+day}
