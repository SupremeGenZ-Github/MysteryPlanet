export const WIDTH=1200,HEIGHT=600;
export const escapeText=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function polygonPath(geometry){
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 return polygons.map(poly=>poly.map(ring=>{
  let previous=null,offset=0;const points=ring.map(([lon,lat])=>{if(previous!==null){while(lon+offset-previous>180)offset-=360;while(lon+offset-previous< -180)offset+=360}previous=lon+offset;return [((previous+180)/360*WIDTH).toFixed(2),((90-Math.max(-90,Math.min(90,lat)))/180*HEIGHT).toFixed(2)]});
  return points.length?'M'+points.map(p=>p.join(',')).join('L')+'Z':'';
 }).join('')).join('');
}
