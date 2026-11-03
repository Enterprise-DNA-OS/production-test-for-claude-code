import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb,REPO_ROOT } from './lib/db.mjs';
import { required,date,readReports,importReports } from './lib/import-wats.mjs';
export const reads={
 sources:'SELECT * FROM sources ORDER BY name',
 stations:'SELECT s.id,so.name AS source,s.name,s.owner FROM stations s JOIN sources so ON so.id=s.source_id ORDER BY so.name,s.name',
 products:'SELECT part_number,revision,count(*)::integer AS reports FROM reports GROUP BY part_number,revision ORDER BY part_number,revision',
 reports:'SELECT r.id,s.name AS source,r.source_report_id,r.part_number,r.revision,r.serial_number,r.process_name,r.started_at,r.result FROM reports r JOIN sources s ON s.id=r.source_id ORDER BY r.started_at,r.source_report_id',
 units:'SELECT * FROM v_units ORDER BY source,part_number,serial_number,process_code',
 yield:'SELECT * FROM v_yield ORDER BY source,part_number,revision,process_code',
 retests:'SELECT source,part_number,revision,serial_number,process_code,attempts,first_result,latest_result,ambiguous_order FROM v_units WHERE attempts>1 ORDER BY source,part_number,serial_number',
 failures:'SELECT * FROM v_failures ORDER BY failed_step_occurrences DESC,source,part_number,station,step',
 trends:"SELECT s.name AS source,(started_at AT TIME ZONE 'UTC')::date AS test_day,r.part_number,r.revision,r.process_code,count(*)::integer AS attempts,count(*) FILTER(WHERE result='P')::integer AS passed_attempts FROM reports r JOIN sources s ON s.id=r.source_id GROUP BY s.name,test_day,r.part_number,r.revision,r.process_code ORDER BY test_day,s.name",
 actions:'SELECT * FROM v_actions ORDER BY state,due,title',
 attention:'SELECT * FROM v_attention ORDER BY kind,reference',
 compliance:'SELECT * FROM v_compliance ORDER BY rule,record',
 imports:'SELECT i.id,s.name AS source,i.source_ref,i.expected_count,i.actor,i.fingerprint,i.created_at FROM imports i JOIN sources s ON s.id=i.source_id ORDER BY i.created_at',
 history:'SELECT * FROM events ORDER BY created_at,id',
 calibrations:'SELECT c.id,s.name AS station,c.valid_from,c.valid_to,c.evidence,c.actor FROM calibrations c JOIN stations s ON s.id=c.station_id ORDER BY s.name,c.valid_from'
};
export const contracts={...Object.fromEntries(Object.keys(reads).map(k=>[k,[]])),help:[],report:['ref'],trace:['serial'],
 'add-source':['name','owner','purpose','access-review','retention-review','actor'],
 'set-station-owner':['ref','owner','actor'],calibrate:['ref','from','to','evidence','actor'],
 'add-action':['ref','title','owner','due','actor'],'close-action':['ref','evidence','actor'],log:['ref','text','actor'],
 import:['source','file','expected-count','source-ref','actor','dry-run'],export:['file'],
 'weekly-review':[],'draft-review':['ref']};
export function parse(args){const [verb='help',...rest]=args; if(!(verb in contracts))throw Error(`Unknown command ${verb}`);const opts={};const positional=[];for(const a of rest){if(!a.startsWith('--')){positional.push(a);continue;}const eq=a.indexOf('=');const k=a.slice(2,eq<0?undefined:eq);if(![...contracts[verb],'json'].includes(k))throw Error(`Unknown flag --${k} for ${verb}`);if(k in opts)throw Error(`Duplicate --${k}`);if(['json','dry-run'].includes(k)){if(eq>=0)throw Error(`--${k} takes no value`);opts[k]=true;}else {if(eq<0)throw Error(`Use --${k}=value`);opts[k]=a.slice(eq+1);}}
 if(verb==='import'?(positional.length!==1||positional[0]!=='wats'):positional.length)throw Error(verb==='import'?'Use import wats':'Unexpected positional argument');return{verb,opts};}
export async function resolve(db,table,ref,label='name'){
 required(ref,'ref'); const rows=await db.query(`SELECT * FROM ${table} WHERE left(id::text,length($1))=lower($1) OR lower(${label})=lower($1) ORDER BY ${label},id`,[ref]);
 if(rows.length!==1)throw Error(rows.length?`Ambiguous ${table}:\n`+rows.map(x=>`${x.id} ${x[label]}`).join('\n'):`No ${table} match: ${ref}`);return rows[0];
}
async function event(db,id,kind,actor,detail){await db.query('INSERT INTO events(entity_id,kind,actor,detail) VALUES($1,$2,$3,$4)',[id,kind,required(actor,'actor'),JSON.stringify(detail)]);}
async function transaction(db,fn){await db.exec('BEGIN');try{const v=await fn();await db.exec('COMMIT');return v;}catch(e){await db.exec('ROLLBACK');throw e;}}
function outputFile(file,data){const p=path.resolve(REPO_ROOT,file);fs.mkdirSync(path.dirname(p),{recursive:true,mode:0o700});fs.writeFileSync(p,data,{flag:'wx',mode:0o600});return p;}
export async function execute(db,args){
 const {verb,opts:o}=parse(args);const need=k=>required(o[k],k);
 if(verb==='help')return Object.entries(contracts).map(([command,flags])=>({command,flags:flags.map(k=>'--'+k+(['dry-run'].includes(k)?'':'=value')).join(' ')}));
 if(reads[verb])return db.query(reads[verb]);
 if(verb==='report'){const r=await resolve(db,'reports',need('ref'),'source_report_id');return[{...r,steps:await db.query('SELECT path,name,status,measurements FROM steps WHERE report_id=$1 ORDER BY path',[r.id]),notes:await db.query('SELECT actor,body,created_at FROM notes WHERE report_id=$1 ORDER BY created_at',[r.id])}];}
 if(verb==='trace')return db.query('SELECT s.name AS source,r.source_report_id,r.part_number,r.revision,r.process_code,r.started_at,r.result FROM reports r JOIN sources s ON s.id=r.source_id WHERE lower(serial_number)=lower($1) ORDER BY started_at,source_report_id',[need('serial')]);
 if(verb==='import'){const source=await resolve(db,'sources',need('source'));return importReports(db,readReports(need('file')),{source,actor:need('actor'),sourceRef:need('source-ref'),expectedCount:Number(need('expected-count')),dryRun:!!o['dry-run']});}
 if(verb==='export'){const data={format:'production-test-v1',exported_at:new Date().toISOString(),records:{}};await db.exec('BEGIN READ ONLY');try{for(const t of ['sources','stations','calibrations','imports','reports','steps','actions','notes','events'])data.records[t]=await db.query(`SELECT * FROM ${t} ORDER BY created_at,id`);}finally{await db.exec('ROLLBACK');}return[{file:outputFile(need('file'),JSON.stringify(data,null,2)+'\n'),tables:Object.keys(data.records).length}];}
 if(['weekly-review','draft-review'].includes(verb)){
  const headings=verb==='weekly-review'?['attention','yield','actions','compliance']:['report','actions'];
  const parts=[];for(const h of headings){const rows=h==='report'?await execute(db,['report',`--ref=${need('ref')}`]):h==='actions'&&verb==='draft-review'?await db.query('SELECT a.* FROM v_actions a JOIN actions original ON original.id=a.id WHERE original.report_id=$1',[(await resolve(db,'reports',need('ref'),'source_report_id')).id]):await db.query(reads[h]);parts.push(`## ${h}\n\n\`\`\`json\n${JSON.stringify(rows,null,2)}\n\`\`\``);}
  const name=`${verb}-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID().slice(0,8)}.md`;
  return[{file:outputFile(path.join('drafts',name),`# ${verb==='weekly-review'?'Production test weekly review':'Production test review packet'}\n\nDraft. Observed history only. No product release or certification.\n\n${parts.join('\n\n')}\n`)}];
 }
 return transaction(db,async()=>{
  const actor=need('actor');let row;
  if(verb==='add-source'){
   [row]=await db.query('INSERT INTO sources(name,owner,purpose,access_review_due,retention_review_due) VALUES($1,$2,$3,$4,$5) RETURNING *',[need('name'),need('owner'),need('purpose'),date(need('access-review'),'access-review'),date(need('retention-review'),'retention-review')]);
  }else if(verb==='set-station-owner'){const s=await resolve(db,'stations',need('ref'));[row]=await db.query('UPDATE stations SET owner=$1 WHERE id=$2 RETURNING *',[need('owner'),s.id]);
  }else if(verb==='calibrate'){const s=await resolve(db,'stations',need('ref'));[row]=await db.query('INSERT INTO calibrations(station_id,valid_from,valid_to,evidence,actor) VALUES($1,$2,$3,$4,$5) RETURNING *',[s.id,date(need('from'),'from'),date(need('to'),'to'),need('evidence'),actor]);
  }else if(verb==='add-action'){const r=await resolve(db,'reports',need('ref'),'source_report_id');[row]=await db.query('INSERT INTO actions(report_id,title,owner,due,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *',[r.id,need('title'),need('owner'),date(need('due'),'due'),actor]);
  }else if(verb==='close-action'){const a=await resolve(db,'actions',need('ref'),'title');[row]=await db.query("UPDATE actions SET state='closed',closure_evidence=$1,closed_by=$2,closed_at=now() WHERE id=$3 AND state='open' RETURNING *",[need('evidence'),actor,a.id]);if(!row)throw Error('Action is already closed');
  }else if(verb==='log'){const r=await resolve(db,'reports',need('ref'),'source_report_id');[row]=await db.query('INSERT INTO notes(report_id,actor,body) VALUES($1,$2,$3) RETURNING *',[r.id,actor,need('text')]);}
  if(!row)throw Error('Unsupported command');await event(db,row.id,verb,actor,row);return[row];
 });
}
export function format(rows){if(!rows.length)return 'No records.';const cols=Object.keys(rows[0]);const val=v=>v===null?'unknown':v instanceof Date?v.toISOString():typeof v==='object'?JSON.stringify(v):String(v);const clean=v=>val(v).replace(/[\r\n\t]/g,' ');const widths=cols.map(c=>Math.min(60,Math.max(c.length,...rows.map(r=>clean(r[c]).length))));return[cols.map((c,i)=>c.padEnd(widths[i])).join(' | '),cols.map((c,i)=>'-'.repeat(widths[i])).join('-|-'),...rows.map(r=>cols.map((c,i)=>clean(r[c]).slice(0,widths[i]).padEnd(widths[i])).join(' | '))].join('\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{const p=parse(process.argv.slice(2));db=await getDb();const result=await execute(db,process.argv.slice(2));console.log(p.opts.json?JSON.stringify(result,null,2):format(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}}
