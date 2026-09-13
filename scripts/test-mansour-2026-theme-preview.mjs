import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const tournament=read('tournament.html');
const preview=read('preview-mansour-2026.css');

assert(tournament.includes("params.get('theme_preview')!=='mansour-2026'"),'preview must require its explicit URL flag');
assert(tournament.includes("params.get('id')!==mansour2026"),'preview must be limited to Mansour 2026');
assert(preview.includes('html.theme-preview-mansour-2026'),'every preview rule must remain scoped');
assert(!preview.includes('.hero-side-logo'),'preview must not alter tournament logos');
assert(!preview.includes('font-family'),'preview must not alter the unified tournament font');
assert(!preview.includes('.hero-title'),'preview must not hide or restyle the tournament heading');

console.log('Mansour 2026 theme preview safeguards passed');
