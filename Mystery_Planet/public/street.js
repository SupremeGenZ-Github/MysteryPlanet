import {pointIn,distance,shuffle} from './core.js';
import {createGuessMap} from './guess-map.js';
let sdkPromise,active=null;
const used=new Set();
export function inArea(point,place,geometries){return Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&distance(point,place)<=5&&geometries.some(g=>pointIn(g,[point.lon,point.lat]))}
export function imagePoint(image){const geometry=image.computed_geometry?.coordinates?image.computed_geometry:image.geometry;if(geometry?.type!=='Point'||!Array.isArray(geometry.coordinates))return null;const [lon,lat]=geometry.coordinates;return Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=-180&&lon<=180&&lat>=-90&&lat<=90?{lat,lon}:null}
export function searchBoxes(place,rng=Math.random){const cosine=Math.max(.05,Math.cos(place.lat*Math.PI/180)),lat=Math.max(-89.9,Math.min(89.9,place.lat+(rng()-.5)*.04));let lon=place.lon+(rng()-.5)*.04/cosine;lon=((lon+540)%360)-180;const dy=.0065,dx=dy/cosine,s=Math.max(-90,lat-dy),n=Math.min(90,lat+dy),w=lon-dx,e=lon+dx;if(w< -180)return [[w+360,s,180,n],[-180,s,e,n]];if(e>180)return [[w,s,180,n],[-180,s,e-360,n]];return [[w,s,e,n]]}
function abortError(){return new DOMException('Imagery request cancelled.','AbortError')}
export async function findImagery({token,place,countryGeometry,panoramasOnly=true,fetchImpl=fetch,maxAttempts=6,rng=Math.random,signal,usedIds=used}){
 if(!token?.trim())throw Error('Add your Mapillary client access token in Settings first.');
 if(!countryGeometry?.length)throw Error('Mapillary imagery unavailable here: a non-disputed country boundary is not available for this pool. Choose clue-based play.');
 const budget=Math.max(1,Math.min(6,Math.floor(maxAttempts)||6));let calls=0,transient=false;
 while(calls<budget){for(const box of searchBoxes(place,rng)){if(calls>=budget)break;if(signal?.aborted)throw abortError();calls++;
  const url=new URL('https://graph.mapillary.com/images');url.searchParams.set('access_token',token.trim());url.searchParams.set('fields','id,computed_geometry,geometry,is_pano,captured_at');url.searchParams.set('bbox',box.join(','));url.searchParams.set('limit','25');if(panoramasOnly)url.searchParams.set('is_pano','true');
  let response;try{response=await fetchImpl(url.toString(),{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)})}catch(e){if(signal?.aborted||e.name==='AbortError')throw e;if(e.name==='TimeoutError'){transient=true;continue}throw Error('Could not reach Mapillary. Check your connection and try again.')}
  let data;try{data=await response.json()}catch{transient=true;continue}
  if(response.status===429)throw Error('Mapillary is limiting requests right now. Please wait and try again.');
  if(response.status===401||response.status===403||data.error?.code===190)throw Error('Mapillary could not authorize this client token. Check the token and application settings.');
  if(!response.ok||data.error){if(response.status>=500||/timed?\s*out|timeout/i.test(data.error?.message||'')){transient=true;continue}throw Error('Mapillary could not complete the imagery search. Check the token and try again.')}
  for(const image of shuffle(Array.isArray(data.data)?data.data:[],rng)){const id=String(image.id||'');if(!/^\d+$/.test(id)||usedIds.has(id)||panoramasOnly&&image.is_pano!==true)continue;const point=imagePoint(image);if(!point||!inArea(point,place,countryGeometry))continue;return {image:{...image,id},point,requests:calls}}
 }}
 throw Error(transient?'Mapillary search timed out or was temporarily unavailable. Try again later.':panoramasOnly?'No unused Mapillary panorama was found in this exact area. Try Photos & panoramas, another supported pool, or clue-based play.':'Mapillary imagery unavailable here. No unused image passed the selected area checks. Choose another supported pool or clue-based play.');
}
export function viewerOptions(token,container,rule){const moving=rule==='moving',locked=rule==='locked';return {accessToken:token,container,trackResize:true,component:{attribution:true,cover:false,bearing:true,direction:moving,sequence:moving,spatial:false,cache:moving,keyboard:locked?false:{keyPlay:false,keySequenceNavigation:moving,keySpatialNavigation:moving,keyZoom:true},pointer:locked?false:{dragPan:true,scrollZoom:true,touchZoom:true,earthControl:false},zoom:!locked}}}
export function loadMapillary(){if(window.mapillary?.Viewer)return Promise.resolve(window.mapillary);if(sdkPromise)return sdkPromise;sdkPromise=new Promise((ok,no)=>{let css=document.querySelector('[data-mapillary-css]');if(!css){css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/mapillary/mapillary.css';css.dataset.mapillaryCss='true';document.head.append(css)}const script=document.createElement('script');script.src='/vendor/mapillary/mapillary.js';script.async=true;let timer=setTimeout(()=>{sdkPromise=null;script.remove();no(Error('Mapillary viewer took too long to load. Please retry.'))},15000);script.onload=()=>{clearTimeout(timer);if(window.mapillary?.Viewer)ok(window.mapillary);else{sdkPromise=null;no(Error('The Mapillary viewer could not be initialized.'))}};script.onerror=()=>{clearTimeout(timer);sdkPromise=null;script.remove();no(Error('The Mapillary viewer files could not load. Please refresh.'))};document.head.append(script)});return sdkPromise}
export function disposeStreet(){if(!active)return;const state=active;active=null;state.controller.abort();clearInterval(state.timer);state.observer?.disconnect();state.guessMap?.dispose();try{state.viewer?.remove()}catch{}}
export async function startStreet({token,place,countryGeometry,worldFeatures,rule='moving',panoramasOnly=true,stage,status,onResult,motion=true}){
 disposeStreet();const state={controller:new AbortController(),timer:null,viewer:null,observer:null,guessMap:null};active=state;
 const alive=()=>active===state&&stage.isConnected&&!state.controller.signal.aborted;
 try{
  const found=await findImagery({token,place,countryGeometry,panoramasOnly,signal:state.controller.signal});const sdk=await loadMapillary();if(!alive())throw abortError();
  stage.innerHTML='<p class="subtle">One round · 90 seconds · max. 5,000 points <span id="streetTime"></span></p><div class="street-pano" id="mapillaryPanorama" aria-label="Mapillary street-level imagery"></div><p class="subtle imagery-kind"></p><div class="street-map" id="guessMap"></div><button class="primary" id="streetSubmit" disabled>Lock in your pin →</button><div id="streetResult" role="status"></div><p class="subtle imagery-attribution">Imagery © Mapillary contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA</a> · <a class="imagery-source" target="_blank" rel="noopener">View source image on Mapillary</a></p>';
  const container=stage.querySelector('#mapillaryPanorama'),sourceLink=stage.querySelector('.imagery-source');sourceLink.href='https://www.mapillary.com/app/?pKey='+encodeURIComponent(found.image.id)+'&focus=photo';
  stage.querySelector('.imagery-kind').textContent=found.image.is_pano?'360° community panorama':'Community photograph · not a full 360° panorama';
  let viewer;try{viewer=new sdk.Viewer(viewerOptions(token,container,rule));state.viewer=viewer;await viewer.moveTo(found.image.id)}catch(e){if(!alive())throw abortError();throw Error('Mapillary imagery could not open. Check your client token, connection and browser WebGL support.')}
  if(!alive())throw abortError();used.add(found.image.id);
  if(rule!=='moving'){let restoring=false;viewer.on('image',event=>{if(!alive()||restoring||event.image?.id===found.image.id)return;restoring=true;viewer.moveTo(found.image.id).catch(()=>{}).finally(()=>restoring=false)})}
  let guess=null,done=false,seconds=90;
  state.guessMap=createGuessMap(stage.querySelector('#guessMap'),{features:worldFeatures,onGuess:p=>{if(done)return;guess=p;stage.querySelector('#streetSubmit').disabled=false},motion});
  function finish(){if(done||!alive())return;done=true;clearInterval(state.timer);stage.querySelector('#streetSubmit').disabled=true;const km=guess?distance(guess,found.point):null,points=guess?Math.round(5000*Math.exp(-km/2000)):0;state.guessMap.reveal(found.point);stage.querySelector('#streetResult').textContent=`${place.name}: ${km===null?'No pin placed':Math.round(km).toLocaleString()+' km away'} · ${points.toLocaleString()} points. The answer marks the starting image. Start another round above.`;if(guess)onResult({distance:km,score:points})}
  stage.querySelector('#streetSubmit').onclick=finish;
  state.timer=setInterval(()=>{if(!alive()){disposeStreet();return}seconds--;stage.querySelector('#streetTime').textContent='· '+seconds+'s';if(seconds<=0)finish()},1000);
  state.observer=new MutationObserver(()=>{if(!stage.isConnected&&active===state)disposeStreet()});state.observer.observe(document.body,{childList:true,subtree:true});
  status.textContent='Mapillary imagery verified inside the selected 5 km area and country boundary. Attribution is preserved.';
 }catch(e){if(active===state)disposeStreet();throw e}
}
