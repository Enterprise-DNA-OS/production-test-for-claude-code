import { createHash } from 'node:crypto';
import { readFileSync,readdirSync,statSync } from 'node:fs';
import path from 'node:path';
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const required=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error(`${label} must be nonempty text`);return v.trim();};
export function date(v,label) { required(v,label); if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(`${label} must be a real YYYY-MM-DD date`); return v; }
const states=new Set(['P','F','E','T','S','D']);
function state(v){if(!states.has(v))throw Error(`Unknown WATS result: ${v}`);return v;}
function timestamp(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('start needs an ISO timestamp with timezone'); date(v.slice(0,10),'start date'); return new Date(v).toISOString();}
export function normalize(raw){
 if(!raw||raw.type!=='T')throw Error('Only WSJF UUT test reports (type T) are supported; keep repair reports separately');
 const r={source_report_id:required(raw.id,'id'),part_number:required(raw.pn,'pn'),revision:required(raw.rev,'rev'),serial_number:required(raw.sn,'sn'),process_code:String(raw.processCode??''),process_name:required(raw.processName,'processName'),station:required(raw.machineName,'machineName'),started_at:timestamp(raw.start),result:state(raw.result),duration_seconds:raw.uut?.execTime??null,batch_serial:raw.uut?.batchSN??null,raw,record_hash:hash(raw),steps:[]};
 required(r.process_code,'processCode');
 if(r.duration_seconds!==null&&(typeof r.duration_seconds!=='number'||!Number.isFinite(r.duration_seconds)||r.duration_seconds<0))throw Error('execTime must be a nonnegative number or null');
 if(!raw.root||typeof raw.root!=='object')throw Error('root step is required; use a complete WSJF export');
 function walk(s,p){
  required(s.name,'step name');state(s.status);
  const kids=s.steps??[];if(!Array.isArray(kids))throw Error('steps must be an array');
  const ms=['numericMeas','booleanMeas','stringMeas'].flatMap(k=>{if(s[k]!==undefined&&!Array.isArray(s[k]))throw Error(`${k} must be an array`);return(s[k]??[]).map(m=>{state(m.status);return{kind:k,...m};});});
  if(!kids.length||ms.length)r.steps.push({path:p,name:s.name,status:s.status,measurements:ms});
  kids.forEach((x,i)=>walk(x,`${p}/${i}`));
 }
 walk(raw.root,'0');return r;
}
export function readReports(file){
 const p=path.resolve(file); const files=statSync(p).isDirectory()?readdirSync(p).filter(f=>f.endsWith('.json')).sort().map(f=>path.join(p,f)):[p];
 const raw=files.flatMap(f=>{const v=JSON.parse(readFileSync(f,'utf8').replace(/^\uFEFF/,''));return Array.isArray(v)?v:[v];});
 if(!raw.length)throw Error('No WSJF reports found');
 const out=raw.map(normalize); const ids=out.map(r=>r.source_report_id);if(new Set(ids).size!==ids.length)throw Error('Duplicate source report IDs in input');return out;
}
export async function importReports(db,rows,{source,actor,sourceRef,expectedCount,dryRun=false}){
 required(actor,'actor');required(sourceRef,'source-ref');
 if(!Number.isInteger(expectedCount)||expectedCount<=0||expectedCount!==rows.length)throw Error(`Expected count ${expectedCount} does not match ${rows.length} reports`);
 const fingerprint=hash(rows.map(r=>[r.source_report_id,r.record_hash]).sort((a,b)=>a[0].localeCompare(b[0])));
 await db.exec('BEGIN');
 try{
  // Serialise imports for this source so concurrent batches cannot race on identities.
  await db.query('SELECT id FROM sources WHERE id=$1 FOR UPDATE',[source.id]);
  const prior=await db.query('SELECT id FROM imports WHERE source_id=$1 AND fingerprint=$2',[source.id,fingerprint]);
  if(prior.length){await db.exec('ROLLBACK');return[{status:'already imported',reports:rows.length,added:0}];}
  const fresh=[];
  for(const r of rows){const old=await db.query('SELECT record_hash FROM reports WHERE source_id=$1 AND source_report_id=$2',[source.id,r.source_report_id]);if(old.length&&old[0].record_hash!==r.record_hash)throw Error(`Conflicting source report ${r.source_report_id}; original evidence retained`);if(!old.length)fresh.push(r);}
  if(dryRun){await db.exec('ROLLBACK');return[{status:'dry run',reports:rows.length,added:fresh.length,existing:rows.length-fresh.length}];}
  const [batch]=await db.query('INSERT INTO imports(source_id,fingerprint,source_ref,expected_count,actor) VALUES($1,$2,$3,$4,$5) RETURNING id',[source.id,fingerprint,sourceRef,expectedCount,actor]);
  for(const r of fresh){
   const [st]=await db.query('INSERT INTO stations(source_id,name) VALUES($1,$2) ON CONFLICT(source_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[source.id,r.station]);
   const cols=['source_report_id','part_number','revision','serial_number','process_code','process_name','started_at','result','duration_seconds','batch_serial','raw','record_hash'];
   const vals=cols.map(k=>k==='raw'?JSON.stringify(r[k]):r[k]);
   const [report]=await db.query(`INSERT INTO reports(source_id,import_id,station_id,${cols.join(',')}) VALUES(${[source.id,batch.id,st.id,...vals].map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,[source.id,batch.id,st.id,...vals]);
   for(const s of r.steps)await db.query('INSERT INTO steps(report_id,path,name,status,measurements) VALUES($1,$2,$3,$4,$5)',[report.id,s.path,s.name,s.status,JSON.stringify(s.measurements)]);
  }
  await db.query('INSERT INTO events(entity_id,kind,actor,detail) VALUES($1,$2,$3,$4)',[batch.id,'import',actor,JSON.stringify({sourceRef,reports:rows.length,added:fresh.length,fingerprint})]);
  await db.exec('COMMIT');return[{status:'imported',reports:rows.length,added:fresh.length,existing:rows.length-fresh.length}];
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
