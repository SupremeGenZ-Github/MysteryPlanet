import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url),root=dirname(require.resolve('mapillary-js/package.json'));
const version=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
const output=new URL('../public/vendor/mapillary/',import.meta.url);await mkdir(output,{recursive:true});
for(const file of ['mapillary.js','mapillary.css'])await copyFile(resolve(root,'dist',file),new URL(file,output));
await copyFile(resolve(root,'LICENSE'),new URL('LICENSE',output));
await writeFile(new URL('VERSION.txt',output),`MapillaryJS ${version}\nSource: https://github.com/mapillary/mapillary-js\nDistribution: npm mapillary-js\nLicense: MIT (see LICENSE).\n`);
// Keep dependency license notices with the bundled SDK. Code stays under its original license.
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));let notices=[];
for(const name of Object.keys(lock.packages||{}).filter(n=>n.startsWith('node_modules/'))){const base=new URL('../'+name+'/',import.meta.url);for(const file of ['LICENSE','LICENSE.md','LICENSE.txt','LICENSE-MIT','LICENCE','COPYING','LICENSE-MIT.txt']){try{const license=await readFile(new URL(file,base),'utf8');notices.push(`\n--- ${name} ---\n${license}`);break}catch{}}}
await writeFile(new URL('DEPENDENCY_NOTICES.txt',output),notices.join('\n'));console.log('MapillaryJS '+version+' viewer assets and license notices prepared.');
