import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb,REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { execute,contracts,parse } from './production.mjs';
import { normalize } from './lib/import-wats.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'production-test-'));
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';process.env.DATA_DIR=path.join(tmp,'db');process.env.OUTPUT_DIR=tmp;
let db=await getDb();const seen=new Set();
const run=async(v,...args)=>{seen.add(v);return execute(db,[v,...args]);};
const rejects=async(fn,re)=>assert.rejects(fn,re);
try{
 if(process.env.TEST_DATABASE_URL){const tables=await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");assert.equal(tables.length,0,'TEST_DATABASE_URL must be an empty disposable database');}
 await migrate(db);assert.equal((await migrate(db)).ran.length,0);
 const seed=fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8');await db.exec(seed);await db.exec(seed);
 assert.equal((await run('reports')).length,7);assert.ok((await run('history')).length>0);
 const y=await run('yield');const ctrl=y.find(r=>r.part_number==='CTRL-10'&&r.process_code==='10');assert.equal(ctrl.observed_units,4);assert.equal(Number(ctrl.first_observed_pass_pct),25);assert.equal(ctrl.retested_units,1);
 const retests=await run('retests');assert.equal(retests.length,1);assert.equal(retests[0].first_result,'F');assert.equal(retests[0].latest_result,'P');
 const reports=await run('reports');const first=reports[0];assert.equal((await run('report','--ref='+first.id.slice(0,12)))[0].steps.length,1);
 assert.equal((await run('trace','--serial=sn-101')).length,2);
 for(const v of ['sources','stations','products','units','failures','trends','actions','attention','compliance','imports','history','calibrations','help'])await run(v);
 assert.ok((await run('failures')).some(r=>r.failed_step_occurrences>=2));assert.ok((await run('compliance')).some(r=>r.rule==='calibration-evidence'));
 await rejects(()=>db.query('UPDATE reports SET result=$1 WHERE id=$2',['P',first.id]),/append-only/);
 const repeatedSeed=await run('import','wats','--source=Fictional Electronics','--file='+path.join(REPO_ROOT,'examples/wats-uut.json'),'--expected-count=7','--source-ref=Repeated fictional evidence','--actor=Test operator');assert.equal(repeatedSeed[0].added,0);
 const [source]=await run('add-source','--name=Imported sample','--owner=Actual test operator','--purpose=Test only','--access-review=2027-01-01','--retention-review=2027-02-01','--actor=Test operator');
 const base=['wats','--source=imported sample','--file='+path.join(REPO_ROOT,'examples/wats-uut.json'),'--expected-count=7','--source-ref=Fictional export all seven reports','--actor=Test operator'];
 assert.equal((await run('import',...base,'--dry-run'))[0].added,7);assert.equal((await run('reports')).length,7);
 assert.equal((await run('import',...base))[0].added,7);assert.equal((await run('import',...base))[0].added,0);assert.equal((await run('reports')).length,14);
 await rejects(()=>run('report','--ref='+first.source_report_id),/Ambiguous/);
 const imported=(await run('reports')).filter(r=>r.source==='Imported sample');const ref=imported[0].id;
 const original=JSON.parse(fs.readFileSync(path.join(REPO_ROOT,'examples/wats-uut.json')));const altered=structuredClone(original);altered[0].result='P';const conflict=path.join(tmp,'conflict.json');fs.writeFileSync(conflict,JSON.stringify(altered));
 await rejects(()=>run('import',...base.map(s=>s.startsWith('--file=')?'--file='+conflict:s)),/Conflicting/);assert.equal((await run('reports')).length,14);
 await rejects(()=>run('import',...base.map(s=>s==='--expected-count=7'?'--expected-count=6':s)),/does not match/);
 const malformed=structuredClone(original);malformed[6].start='2026-02-30T10:00:00Z';const bad=path.join(tmp,'bad.json');fs.writeFileSync(bad,JSON.stringify(malformed));await rejects(()=>run('import',...base.map(s=>s.startsWith('--file=')?'--file='+bad:s)),/real YYYY/);
 const duplicate=path.join(tmp,'duplicate.json');fs.writeFileSync(duplicate,JSON.stringify([original[0],original[0]]));await rejects(()=>run('import',...base.map(s=>s.startsWith('--file=')?'--file='+duplicate:s)),/Duplicate/);
 assert.throws(()=>normalize({...original[0],type:'R'}),/Only WSJF/);assert.throws(()=>normalize({...original[0],result:'Unknown'}),/Unknown/);
 assert.throws(()=>parse(['yield','--typo']),/Unknown flag/);assert.throws(()=>parse(['yield','junk']),/Unexpected/);assert.throws(()=>parse(['help','--json=false']),/no value/);
 const stations=(await run('stations')).filter(s=>s.source==='Imported sample');const station=stations[0];await run('set-station-owner','--ref='+station.id,'--owner=Test owner','--actor=Test operator');
 await run('calibrate','--ref='+station.id,'--from=2026-01-01','--to=2026-12-31','--evidence=Test certificate reference','--actor=Test operator');
 const [a]=await run('add-action','--ref='+ref,'--title=Check <script>alert(1)</script> & evidence','--owner=Test owner','--due=2026-10-01','--actor=Test operator');
 await run('log','--ref='+ref,'--text=Recheck supply <b>evidence</b>','--actor=Test operator');
 await rejects(()=>run('close-action','--ref='+a.id,'--evidence=','--actor=Test operator'),/nonempty/);
 await run('close-action','--ref='+a.id,'--evidence=Reviewed fixture and saved follow-up result','--actor=Test reviewer');
 await rejects(()=>run('close-action','--ref='+a.id,'--evidence=again','--actor=Test reviewer'),/already closed/);
 // Equal timestamps must not manufacture a confident first-pass result.
 const tie=structuredClone(original[0]);tie.id='tie-record';tie.result='P';const tied=path.join(tmp,'tie.json');fs.writeFileSync(tied,JSON.stringify(tie));await run('import','wats','--source='+source.id,'--file='+tied,'--expected-count=1','--source-ref=Fictional tie','--actor=Test operator');
 assert.equal((await run('yield')).find(x=>x.source==='Imported sample'&&x.part_number==='CTRL-10'&&x.process_code==='10').first_observed_pass_pct,null);
 for(const verb of ['weekly-review','draft-review']){const out=await run(verb,...(verb==='draft-review'?['--ref='+ref]:[]));assert.ok(fs.readFileSync(out[0].file,'utf8').includes('Draft.'));fs.rmSync(out[0].file);}
 const file=path.join(tmp,'backup.json');await run('export','--file='+file);assert.equal(Object.keys(JSON.parse(fs.readFileSync(file)).records).length,9);await rejects(()=>run('export','--file='+file),/EEXIST/);
 await db.close();db=null;
 for(const script of ['view','docs']){const p=spawnSync(process.execPath,['scripts/'+script+'.mjs'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(p.status,0,p.stderr);}
 const doc=fs.readFileSync(path.join(tmp,'docs-out','corrective-action',fs.readdirSync(path.join(tmp,'docs-out','corrective-action')).find(f=>f.includes(a.id))),'utf8');assert.ok(doc.includes('&lt;script&gt;'));assert.ok(!doc.includes('<script>'));
 const cli=spawnSync(process.execPath,['scripts/production.mjs','yield'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);assert.ok(cli.stdout.includes('first_observed_pass_pct'));
 const fail=spawnSync(process.execPath,['scripts/production.mjs','report','--ref='+first.source_report_id],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(fail.status,1);assert.match(fail.stderr,/Ambiguous/);
 assert.deepEqual(Object.keys(contracts).filter(k=>!seen.has(k)),[],'Every CLI command exercised');
 console.log(`PASS: ${seen.size} CLI commands; import rollback, idempotency, isolated sources, yield, ambiguity, evidence, export, documents and escaping`);
}finally{await db?.close();fs.rmSync(tmp,{recursive:true,force:true});}
