import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const page=fs.readFileSync(new URL('news-center-preview.html',root),'utf8');
const scope=fs.readFileSync(new URL('tournament-scope.js',root),'utf8');
const theme=fs.readFileSync(new URL('tournament-theme.css',root),'utf8');

const inline=[...page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
assert.equal(inline.length,1,'expected one inline application script');
new vm.Script(inline[0]);

for(const mutation of ['.insert(','.update(','.delete(','.upsert(']){
  assert.equal(page.includes(mutation),false,`preview must not contain ${mutation}`);
}
assert.match(page,/DEFAULT_TOURNAMENT='aaaaaaaa-0000-0000-0000-000000000001'/);
assert.match(page,/\.eq\('tournament_id',id\)/);
assert.match(page,/function dedupe\(/);
assert.match(page,/round:groups/);
assert.match(page,/round:quarter/);
assert.match(page,/round:semi/);
assert.match(page,/m\.round_name==='final'/);
assert.match(page,/أعلى مباريات البطولة تسجيلًا/);
assert.match(page,/لم تُستخدم لتوليد ادعاءات غير مؤكدة/);
assert.match(page,/تغطيات خارجية/);
assert.match(page,/خبر يدوي تجريبي/);
assert.match(page,/@media\(max-width:680px\)/);
assert.match(page,/prefers-reduced-motion/);
assert.match(page,/ticker-official/);
assert.match(page,/ticker-matches/);
assert.match(page,/ticker-players/);
assert.match(page,/ticker:hover \.ticker-track/);
assert.match(page,/\$\$\('\[data-close\]'\)\.forEach/);
assert.ok((page.match(/repeating-linear-gradient/g)||[]).length>=4,'expected layered diagonal texture');
assert.match(scope,/function themePalette\(/);
assert.match(scope,/--theme-primary-deep/);
assert.match(scope,/--theme-primary-soft/);
assert.match(theme,/\.tournament-gradient-surface/);
assert.match(theme,/repeating-linear-gradient/);

console.log('Smart News Center preview checks passed');
