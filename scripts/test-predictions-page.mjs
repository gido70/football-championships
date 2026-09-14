import fs from 'node:fs';
const page=fs.readFileSync('predictions.html','utf8');
const account=fs.readFileSync('participant-account.html','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(page.includes("storageKey:'tournament-participant-auth'"),'participant auth storage must remain isolated');
ok(page.includes("participant_tournament_memberships"),'page must link participant to tournament');
ok(page.includes("participant_predictions"),'page must use isolated prediction table');
ok(!page.includes("from('matches')")&&!page.includes("from(\"matches\")"),'test page must not write real matches');
ok(page.includes('winner_points')&&page.includes('exact_bonus'),'scoring must come from round settings');
ok(page.includes('lock_minutes'),'lock window must come from round settings');
ok(page.includes('العودة للبطولة'),'page must provide a return path');
ok(account.includes("nextPage")&&account.includes('predictions.html'),'account creation must return to predictions');
console.log('prediction page safety checks passed');
