import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const page=fs.readFileSync(new URL('news-center-preview.html',root),'utf8');
const scope=fs.readFileSync(new URL('tournament-scope.js',root),'utf8');
const theme=fs.readFileSync(new URL('tournament-theme.css',root),'utf8');
const home=fs.readFileSync(new URL('index.html',root),'utf8');
const tournament=fs.readFileSync(new URL('tournament.html',root),'utf8');
const videos=fs.readFileSync(new URL('videos.html',root),'utf8');

const inline=[...page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
assert.equal(inline.length,1,'expected one inline application script');
new vm.Script(inline[0]);

for(const mutation of ['.insert(','.update(','.delete(','.upsert(']){
  assert.equal(page.includes(mutation),false,`preview must not contain ${mutation}`);
}
assert.match(page,/\.eq\('tournament_id',id\)/);
assert.match(page,/function dedupe\(/);
assert.match(page,/round:groups/);
assert.match(page,/round:quarter/);
assert.match(page,/round:semi/);
assert.match(page,/m\.round_name==='final'/);
assert.match(page,/أعلى مباريات البطولة تسجيلًا/);
assert.match(page,/id="backToTournament"/);
assert.match(page,/scopedUrl\('tournament\.html\?id='/);
assert.match(page,/id="tournamentFilter"/);
assert.match(page,/id="stageFilter"/);
assert.match(page,/loadGlobalNews\(/);
assert.match(page,/\.neq\('status','draft'\)/);
assert.match(page,/function sortNewest\(/);
assert.match(page,/state\.tournamentFilter/);
assert.match(page,/state\.stageFilter/);
assert.match(home,/href="news-center-preview\.html"/);
assert.doesNotMatch(home,/news-center-preview\.html\?id=/);
assert.match(tournament,/includes\('2026'\)/);
assert.match(tournament,/modern-media-title/);
assert.match(videos,/MODERN_TITLES/);
assert.match(videos,/select\('name,name_ar,season_label,/);
assert.match(page,/loadRequestedTournament\(\)/);
assert.doesNotMatch(page,/<nav class="view-tabs"/);
assert.doesNotMatch(page,/id="editorView"/);
assert.doesNotMatch(page,/id="tickerTrack"/);
assert.doesNotMatch(page,/id="missingBox"/);
assert.match(page,/const publicText=/);
assert.match(page,/@media\(max-width:680px\)/);
assert.match(page,/prefers-reduced-motion/);
assert.match(page,/\$\$\('\[data-close\]'\)\.forEach/);
assert.ok((page.match(/repeating-linear-gradient/g)||[]).length>=4,'expected layered diagonal texture');
assert.match(scope,/function themePalette\(/);
assert.match(scope,/--theme-primary-deep/);
assert.match(scope,/--theme-primary-soft/);
assert.match(theme,/\.tournament-gradient-surface/);
assert.match(theme,/repeating-linear-gradient/);

console.log('Smart News Center preview checks passed');
