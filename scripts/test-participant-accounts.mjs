import fs from 'node:fs';
const sql=fs.readFileSync('participant_accounts.sql','utf8');
const page=fs.readFileSync('participant-account.html','utf8');
const guard=fs.readFileSync('auth-guard.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(sql.includes('enable row level security'),'RLS must be enabled');
ok(sql.includes("auth.uid()) = user_id"),'profile access must be owner-scoped');
ok(sql.includes("auth.uid()) = participant_id"),'membership access must be owner-scoped');
ok(sql.includes('revoke all on public.participant_profiles from anon'),'anon table grants must be revoked');
ok(sql.includes("participant_code ~ '^[0-9]{6}$'"),'participant code must be six digits');
ok(page.includes('signInAnonymously()'),'free anonymous auth must be used');
ok(page.includes('id="phone"')&&page.includes('لا يظهر للجمهور'),'winner contact phone must be private and clearly explained');
ok(page.includes("select('first_name,family_name,participant_code,phone')")&&page.includes(".update(fields).eq('user_id',session.user.id)"),'existing participants must be prompted once for their phone');
ok(guard.includes("session.user.id !== ADMIN_USER_ID")&&guard.includes('session.user.is_anonymous'),'admin guard must reject participant sessions');
console.log('participant account safety checks passed');
