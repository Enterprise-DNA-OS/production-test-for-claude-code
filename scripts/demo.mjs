import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './lib/db.mjs';
for(const args of [['scripts/migrate.mjs'],['scripts/seed.mjs'],['scripts/production.mjs','yield'],['scripts/production.mjs','retests'],['scripts/production.mjs','attention']]){
 const r=spawnSync(process.execPath,args,{cwd:REPO_ROOT,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
