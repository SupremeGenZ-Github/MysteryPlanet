import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import pg from 'pg';

function sqlite(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const raw=new DatabaseSync(path,{timeout:5000});
 raw.exec(readFileSync(new URL('./migrations/001.sql',import.meta.url),'utf8'));
 let tail=Promise.resolve();
 const db={dialect:'sqlite',prepare:sql=>raw.prepare(sql),exec:sql=>raw.exec(sql),close:()=>raw.close(),ping:()=>raw.prepare('SELECT 1').get()};
 db.transaction=async fn=>{const prior=tail;let done;tail=new Promise(r=>done=r);await prior;try{raw.exec('BEGIN IMMEDIATE');try{const result=await fn(db);raw.exec('COMMIT');return result}catch(e){raw.exec('ROLLBACK');throw e}}finally{done()}};
 return db;
}
function postgresAdapter(client){
 const statement=sql=>{let i=0;return sql.replace(/\?/g,()=>'$'+(++i))};
 return {dialect:'postgres',prepare(sql){const text=statement(sql);return {async get(...params){return (await client.query(text,params)).rows[0]},async all(...params){return (await client.query(text,params)).rows},async run(...params){return client.query(text,params)}}},exec:sql=>client.query(sql),ping:()=>client.query('SELECT 1')};
}
export async function openDatabase(target){
 if(!/^postgres(?:ql)?:\/\//i.test(target))return sqlite(target);
 const pool=new pg.Pool({connectionString:target,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:30000,options:'-c search_path=mystery_planet'});
 // Pool errors contain connection details: keep them out of public responses/logs.
 pool.on('error',()=>console.error('A database connection was interrupted. Requests will reconnect.'));
 const db=postgresAdapter(pool);
 db.transaction=async fn=>{const client=await pool.connect();try{await client.query('BEGIN');try{const result=await fn(postgresAdapter(client));await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}}finally{client.release()}};
 db.close=()=>pool.end();
 try{await db.transaction(async tx=>{await tx.exec("SELECT pg_advisory_xact_lock(17354011)");await tx.exec('CREATE SCHEMA IF NOT EXISTS mystery_planet');await tx.exec(readFileSync(new URL('./migrations/001-postgres.sql',import.meta.url),'utf8'))});return db}catch(e){await pool.end();throw e}
}
export async function imported(db){return !!(await db.prepare('SELECT 1 FROM imports WHERE finished=1 LIMIT 1').get())}
export const EMPTY_PROGRESS={xp:0,completed:0,learned:{}};
export async function lockPlayer(db,player){
 await db.prepare('INSERT INTO progress(player,data,updated) VALUES(?,?,?) ON CONFLICT(player) DO NOTHING').run(player,JSON.stringify(EMPTY_PROGRESS),new Date().toISOString());
 return db.prepare('SELECT data FROM progress WHERE player=?'+(db.dialect==='postgres'?' FOR UPDATE':'')).get(player);
}
