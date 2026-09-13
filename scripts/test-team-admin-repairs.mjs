import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const review=read('team-submissions-review.html');
const teams=read('teams-admin.html');
const home=read('admin-home.html');
const report=read('match-report.html');
const player=read('player.html');

for(const [name,page] of [['team-submissions-review.html',review],['teams-admin.html',teams],['admin-home.html',home],['match-report.html',report]]){
  const scripts=[...page.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(Boolean);
  for(const [index,script] of scripts.entries())new vm.Script(script,{filename:`${name}:${index}`});
}

assert.match(review,/id="tournamentSel"/);
assert.match(review,/id="teamSel"/);
assert.match(review,/select\('id,name,season_label'\)/);
assert.doesNotMatch(review,/from\('tournaments'\)\.select\('[^']*name_ar/);
assert.match(review,/\.eq\('tournament_id',TOUR_ID\)/);
assert.match(review,/replaceStaffPhoto/);
assert.match(review,/addNewPlayer/);
assert.match(review,/from\('team-public'\)\.upload/);
assert.match(review,/full_name_ar:name/);
assert.match(teams,/adminTournamentId/);
assert.match(home,/id="adminTournamentSelect"/);
assert.match(home,/localStorage\.setItem\('adminTournamentId'/);
assert.match(player,/const teamBack='team\.html\?id='/);
assert.match(report,/team\.html\?id=/);
assert.match(report,/configureBack\(\$\('backLink'\),back,'السابق'\)/);

console.log('team and admin repair tests passed');
