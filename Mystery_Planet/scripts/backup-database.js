import {DatabaseSync,backup} from 'node:sqlite';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {config} from '../config.js';

try{
 const target=resolve(process.argv[2]||resolve('backups','mystery-planet-'+new Date().toISOString().replaceAll(':','-')+(config.databaseUrl?'.dump':'.sqlite')));
 if(existsSync(target)||(!config.databaseUrl&&target===resolve(config.dbPath)))throw Error('Choose a new backup filename.');
 mkdirSync(dirname(target),{recursive:true});
 if(config.databaseUrl){
  // libpq reads the URL from the child environment; no credential appears in argv.
  await new Promise((ok,no)=>{const child=spawn('pg_dump',['--format=custom','--no-owner','--no-acl','--file',target],{env:{...process.env,PGDATABASE:config.databaseUrl},stdio:'ignore'});child.on('error',no);child.on('exit',code=>code===0?ok():no(Error('pg_dump failed')))});
 }else{
  if(!existsSync(config.dbPath))throw Error('Configured SQLite database missing.');
  const db=new DatabaseSync(config.dbPath);try{await backup(db,target)}finally{db.close()}
 }
 console.log('Database backup saved:',target);
}catch{console.error('Backup failed. Check the database connection, target filename and permissions. PostgreSQL backups require a compatible pg_dump installation. Credentials are never logged.');process.exitCode=1}
