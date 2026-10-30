import {existsSync,readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('.',import.meta.url));
const envFile=resolve(ROOT,'.env');
if(existsSync(envFile)){for(const [key,value] of Object.entries(parseEnv(readFileSync(envFile,'utf8')))){if(process.env[key]===undefined)process.env[key]=value}}
export function configuration(env=process.env){
 const databaseUrl=(env.DATABASE_URL||'').trim();
 if(databaseUrl&&!/^postgres(?:ql)?:\/\//i.test(databaseUrl))throw Error('DATABASE_URL must be a PostgreSQL connection URL.');
 const render=env.RENDER==='true',mode=databaseUrl?'postgres':(env.APP_MODE||(render?'render-free':'local')),temporary=!databaseUrl&&mode==='render-free';
 if(env.APP_MODE==='postgres'&&!databaseUrl)throw Error('Set DATABASE_URL in Render Environment before starting PostgreSQL mode.');
 const origin=(env.APP_ORIGIN||env.RENDER_EXTERNAL_URL||'').replace(/\/$/,'');
 const cookie=env.COOKIE_SECURE||'auto';
 return {databaseUrl,mode,temporary,origin,secureCookie:cookie==='auto'?render||origin.startsWith('https://'):['1','true','yes'].includes(cookie),port:Number(env.PORT||8000),host:env.HOST||'0.0.0.0',dbPath:env.DATABASE_PATH||(temporary?'/tmp/mystery-planet/runtime.sqlite':resolve(ROOT,'var/geography.sqlite')),mapillaryToken:env.MAPILLARY_CLIENT_TOKEN||''};
}
const argv=process.argv.slice(2),devEnv={...process.env};for(const [flag,key]of [['--port','PORT'],['--host','HOST']]){const i=argv.indexOf(flag);if(i>=0&&argv[i+1])devEnv[key]=argv[i+1]}
export const config=configuration(devEnv);
