import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import '../config.js';
const file=process.argv[2],output=process.argv[3]||'var/clue-proposals.json';if(!file)throw Error('Supply a verified facts JSON file.');
const facts=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(facts)||!facts.every(f=>f.id&&f.text&&f.scope&&f.source))throw Error('Each fact requires an id, text, scope and source.');
const key=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL;if(!key||!model)throw Error('Set server-only OPENAI_API_KEY and OPENAI_MODEL. These are optional; normal gameplay does not need them.');
const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,store:false,text:{format:{type:'json_object'}},input:'Return JSON {proposals:[{fact_ids:[id],text:wording,difficulty:easy|medium|hard|expert}]}. Propose geography clue wording only from these verified facts. Preserve scope/dates. Do not invent facts, assert uniqueness, or reveal names prematurely. Human review is required. '+JSON.stringify(facts)})});
if(!response.ok)throw Error('AI request failed; check model access, quota and credentials.');const data=await response.json(),text=(data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');const proposals=JSON.parse(text).proposals,ids=new Set(facts.map(f=>f.id));
if(!Array.isArray(proposals))throw Error('Invalid proposal format.');for(const p of proposals){if(!p.fact_ids?.length||!p.fact_ids.every(id=>ids.has(id)))throw Error('Unknown supporting fact ID.');p.verified=false}
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify({facts,proposals},null,2));console.log('Proposals saved for human review; excluded from scored rounds.');
