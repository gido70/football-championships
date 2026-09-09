import fs from 'node:fs';

const config = fs.readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
const base = config.match(/SUPABASE_URL="([^"]+)"/)[1];
const key = config.match(/SUPABASE_ANON_KEY="([^"]+)"/)[1];
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const tid = 'eee33333-5d2a-4f3b-a981-d4b8f5f86143';
const mid = n => `0cc20001-0000-0000-0000-${String(n).padStart(12, '0')}`;
const team = n => `0cc10001-0000-0000-0000-${String(n).padStart(12, '0')}`;

async function request(path, options = {}) {
  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${body}`);
  return body ? JSON.parse(body) : null;
}

const goals = [
  [1,31,'69a58dba-f264-4ed3-80ad-e7fe406a9b6d',21,null],
  [2,13,'11be0d61-f076-4516-b6c5-e8e94a75bb0d',11,null],
  [2,16,'fe9e7dfe-abca-4930-9692-e5a679d6d04f',19,null],
  [2,13,'9e8d7ded-deae-43f6-b96e-e54677bf10c5',22,null],
  [2,13,'9da95752-0c1e-437d-b737-a7a4efd7928d',43,null],
  [2,16,'88eb9398-ab66-4837-85c5-ffa817dd0356',61,'penalty'],
  [3,10,'50034f7c-06eb-4297-a541-5404b2af0b2f',53,'own_goal'],
  [3,24,'fe76f093-3053-4506-a6c3-a42b97465002',66,null],
  [3,10,'4a8d6a1e-5b3a-4864-8c11-3aeb2af195f8',80,null],
  [3,10,'4a8d6a1e-5b3a-4864-8c11-3aeb2af195f8',85,'penalty'],
  [3,24,'4a8d6a1e-5b3a-4864-8c11-3aeb2af195f8',93,'own_goal'],
  [4,6,'12f6992c-5eca-4472-93f8-331283c6fc42',46,null],
  [4,6,'12f6992c-5eca-4472-93f8-331283c6fc42',91,null],
  [5,20,'4c1ffbd2-c2a3-4a96-8100-b8095fd9ea53',12,null],
  [5,17,'599d5dc1-e071-43c6-97e0-04e4b1bd4464',33,null],
  [5,20,'affee3ba-fd67-4bdc-9425-ed0f5c11b893',36,null],
  [5,17,'599d5dc1-e071-43c6-97e0-04e4b1bd4464',49,null],
  [5,17,'0cd74226-6424-475c-98e1-3441c8ef6a6b',53,null],
  [6,3,'0cc30001-0000-0000-0000-000000000022',14,null],
  [6,3,'0cc30001-0000-0000-0000-000000000015',23,null],
  [6,5,'0cc30002-0000-0000-0000-000000000007',77,null]
].map(([m,t,p,minute,event_subtype]) => ({ tournament_id:tid, match_id:mid(m), team_id:team(t), player_id:p, event_type:'goal', minute, event_subtype }));

const ids = Array.from({length:6}, (_,i)=>mid(i+1)).join(',');
await request(`match_events?match_id=in.(${ids})&event_type=eq.goal`, { method:'DELETE' });
await request('match_events', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify(goals) });

const scores = [
  [1,1,0,'69a58dba-f264-4ed3-80ad-e7fe406a9b6d'],
  [2,2,3,'11be0d61-f076-4516-b6c5-e8e94a75bb0d'],
  [3,3,2,'4a8d6a1e-5b3a-4864-8c11-3aeb2af195f8'],
  [4,0,2,'12f6992c-5eca-4472-93f8-331283c6fc42'],
  [5,2,3,'599d5dc1-e071-43c6-97e0-04e4b1bd4464'],
  [6,2,1,'0cc30001-0000-0000-0000-000000000015']
];
for (const [m,home_score,away_score,player_of_match_id] of scores) {
  await request(`matches?id=eq.${mid(m)}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({home_score,away_score,player_of_match_id}) });
}

const verifyGoals = await request(`match_events?match_id=in.(${ids})&event_type=eq.goal&select=match_id,player_id,minute,event_subtype&order=match_id,minute`);
const verifyMatches = await request(`matches?id=in.(${ids})&select=id,home_score,away_score,player_of_match_id&order=id`);
if (verifyGoals.length !== 21 || verifyMatches.some(m => !m.player_of_match_id)) throw new Error('Verification failed');
console.log(JSON.stringify({goals:verifyGoals.length,matches:verifyMatches}, null, 2));
