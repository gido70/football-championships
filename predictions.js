const PREDICTION_TOURNAMENTS={
  'eee33333-5d2a-4f3b-a981-d4b8f5f86143':{title:'تحدي دوري أبطال أوروبا',logo:'uefa-champions-app-512.png'},
  'c983ee0c-4434-470d-b0a2-6e6efe1ad650':{title:'تحدي كأس منصور بن زايد 2027',logo:'logo-cup-2027-512.png'}
};
const EUROPE='eee33333-5d2a-4f3b-a981-d4b8f5f86143',MANSOUR_2027='c983ee0c-4434-470d-b0a2-6e6efe1ad650';
const query=new URLSearchParams(location.search);
const requestedTournament=query.get('tid');
const TOURNAMENT_ID=PREDICTION_TOURNAMENTS[requestedTournament]?requestedTournament:'eee33333-5d2a-4f3b-a981-d4b8f5f86143';
const tournamentConfig=PREDICTION_TOURNAMENTS[TOURNAMENT_ID];
const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY,{auth:{storageKey:'tournament-participant-auth'}});
const app=document.getElementById('app');
let user,profile,rounds=[],fixtures=[],teams={},predictions={},leaderboard=[];

const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const roundFor=f=>rounds.find(r=>r.id===f.round_id);
const scoreWinner=(f,h,a)=>h===a?null:(h>a?f.home_team_id:f.away_team_id);
const locked=(r,f)=>f.is_locked||f.is_scored||Date.now()>=Math.min(new Date(r.closes_at).getTime(),new Date(f.kickoff_at).getTime()-r.lock_minutes*60000)||r.status!=='open';

function setupBrand(){
  document.title=tournamentConfig.title;
  document.querySelector('.heroLogo').src=tournamentConfig.logo;
  document.querySelector('.title h1').textContent=tournamentConfig.title;
  document.querySelector('.title p').textContent='توقّع النتائج، اجمع النقاط، ونافس حتى النهائي';
  document.getElementById('backLink').href='tournament.html?id='+encodeURIComponent(TOURNAMENT_ID);
}

function teamBlock(id){
  const t=teams[id]||{};
  return `<div class="team"><div class="crest">${t.logo_url?`<img src="${esc(t.logo_url)}" alt="">`:'⚽'}</div><strong>${esc(t.name_ar||t.name||'فريق')}</strong></div>`;
}

function pointsHtml(){
  const hasExact=rounds.some(r=>r.exact_bonus>0);
  if(!hasExact)return `<div class="points" style="grid-template-columns:1fr 24px 1fr"><div><strong>+2</strong><small>الفائز أو التعادل الصحيح</small></div><span>=</span><div><strong>2</strong><small>الحد الأقصى للمباراة</small></div></div>`;
  return `<div class="points"><div><strong>+2</strong><small>المتأهل الصحيح</small></div><span>+</span><div><strong>+2</strong><small>الحسم بالترجيح</small></div><span>+</span><div><strong>+2</strong><small>نتيجة الترجيح الدقيقة</small></div></div>`;
}

function matchHtml(r,f){
  const p=predictions[f.id],isLocked=locked(r,f);
  const knockout=stageKey(r)==='knockout';
  const date=new Intl.DateTimeFormat('ar-AE',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(f.kickoff_at));
  const pens=knockout?`<div style="margin-top:14px;padding:13px;border-radius:15px;background:#fff7dc"><label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" data-pens="${f.id}" ${p?.predicts_penalties?'checked':''} ${isLocked?'disabled':''}> أتوقع أن تُحسم المباراة بركلات الترجيح</label><div data-pens-box="${f.id}" style="display:${p?.predicts_penalties?'grid':'none'};grid-template-columns:1fr 1fr;gap:9px;margin-top:10px"><select data-qualifier="${f.id}" ${isLocked?'disabled':''}><option value="">اختر الفريق المتأهل</option><option value="${f.home_team_id}" ${p?.predicted_winner_team_id===f.home_team_id?'selected':''}>${esc(teams[f.home_team_id]?.name_ar||teams[f.home_team_id]?.name)}</option><option value="${f.away_team_id}" ${p?.predicted_winner_team_id===f.away_team_id?'selected':''}>${esc(teams[f.away_team_id]?.name_ar||teams[f.away_team_id]?.name)}</option></select><div class="score"><input inputmode="numeric" type="number" min="0" max="20" data-home-pens="${f.id}" value="${p?.predicted_home_penalties??''}" placeholder="ترجيح الأول" ${isLocked?'disabled':''}><span>–</span><input inputmode="numeric" type="number" min="0" max="20" data-away-pens="${f.id}" value="${p?.predicted_away_penalties??''}" placeholder="ترجيح الثاني" ${isLocked?'disabled':''}></div></div></div>`:'';
  return `<article class="match"><div class="meta"><span>${r.is_test?'مباراة تجريبية':esc(r.name)}</span><span>${date}</span></div><div class="teams">${teamBlock(f.home_team_id)}<div class="score"><input inputmode="numeric" min="0" max="50" type="number" data-home="${f.id}" value="${p?.predicted_home??''}" ${isLocked?'disabled':''} aria-label="أهداف الفريق الأول"><span>–</span><input inputmode="numeric" min="0" max="50" type="number" data-away="${f.id}" value="${p?.predicted_away??''}" ${isLocked?'disabled':''} aria-label="أهداف الفريق الثاني"></div>${teamBlock(f.away_team_id)}</div>${pens}<button class="save" data-save="${f.id}" ${isLocked?'disabled':''}>${isLocked?'أُغلق الترشيح':p?'تحديث الترشيح':'حفظ الترشيح'}</button><div class="notice" data-note="${f.id}" style="display:${p?'block':'none'}">${p?'ترشيحك محفوظ: '+p.predicted_home+'–'+p.predicted_away:''}</div></article>`;
}

function journeyHtml(f){
  const p=predictions[f.id],r=roundFor(f);
  return `<div class="rank mine"><span>${p?'✓':'—'}</span><span>${esc(r?.name)} · ${esc(teams[f.home_team_id]?.name_ar||teams[f.home_team_id]?.name)} × ${esc(teams[f.away_team_id]?.name_ar||teams[f.away_team_id]?.name)}${f.is_scored&&p?`<small style="display:block;opacity:.82">${p.points||0} نقطة بعد اعتماد النتيجة</small>`:''}</span><b>${p?p.predicted_home+'–'+p.predicted_away:'لم تشارك'}</b></div>`;
}

const stageKey=r=>['group','groups','group_stage','group-stage'].includes(String(r?.stage_code||'').toLowerCase())?'groups':'knockout';
function rankingRows(rows){return rows.map((x,i)=>`<div class="rank ${i<3?'podium p'+(i+1):''} ${x.participant_id===user.id?'mine':''}"><span class="rank-medal">${i<3?['🥇','🥈','🥉'][i]:i+1}</span><span>${esc(x.display_name)}<small style="display:block;opacity:.8">${x.correct_winners} اختيار صحيح · ${x.exact_scores} نتيجة دقيقة</small></span><b>${x.points} نقطة</b></div>`).join('')||'<div class="empty">بانتظار اعتماد أول نتيجة.</div>'}
function groupRanking(){
  const stats=x=>x.phase_points?.group||x.phase_points?.groups||x.phase_points?.group_stage||{};
  return leaderboard.map(x=>({...x,...stats(x)})).filter(x=>Number(x.predictions_count||0)>0).sort((a,b)=>Number(b.points||0)-Number(a.points||0)||Number(b.correct_winners||0)-Number(a.correct_winners||0));
}
function render(){
  if(!rounds.length){
    app.innerHTML=`<div class="account"><span>✓ مرحبًا ${esc(profile.first_name)}</span><span>رمزك: ${esc(profile.participant_code)}</span></div><div class="waiting" style="margin-top:18px"><span>⏳</span><span>بانتظار اعتماد جدول البطولة. ستظهر الفرق والمباريات هنا تلقائيًا فور تسجيل تاريخ ووقت أول مباراة.</span></div><p class="foot">لا تحتاج إلى التسجيل مرة أخرى؛ حسابك جاهز ومحفوظ.</p>`;
    return;
  }
  const roundSections=rounds.map(r=>{
    const list=fixtures.filter(f=>f.round_id===r.id);
    const lockText=r.lock_minutes===0?'الإغلاق فور بدء المباراة':`الإغلاق قبل البداية بـ${r.lock_minutes} دقائق`;
    return `<div class="heading"><h2>${esc(r.name)}</h2><span>${lockText}</span></div>${list.map(f=>matchHtml(r,f)).join('')||'<div class="empty">بانتظار مباريات هذه المرحلة.</div>'}`;
  }).join('');
  const hasGroups=rounds.some(r=>stageKey(r)==='groups');
  app.innerHTML=`<div class="account"><span>✓ مرحبًا ${esc(profile.first_name)}</span><span>رمزك: ${esc(profile.participant_code)}</span></div>${pointsHtml()}<div class="tabs"><button class="tab active" data-tab="picks">الترشيحات</button><button class="tab" data-tab="journey">مساري</button><button class="tab" data-tab="ranking">الترتيب</button></div><section class="panel" id="picks">${roundSections}<div class="waiting"><span>🔄</span><span>الفرق والمواعيد والنتائج تصل تلقائيًا من إدارة البطولة.</span></div></section><section class="panel" id="journey" hidden><div class="heading"><h2>مساري</h2><span>${Object.keys(predictions).length} ترشيح محفوظ</span></div>${fixtures.map(journeyHtml).join('')}</section><section class="panel" id="ranking" hidden>${hasGroups?`<div class="heading"><h2>ترتيب دور المجموعات</h2><span>النقاط المحققة في هذه المرحلة فقط</span></div>${rankingRows(groupRanking())}<div class="waiting"><span>🏁</span><span>يبقى هذا الحصاد واضحًا، وتنتقل النقاط نفسها مع المشاركين إلى ربع النهائي.</span></div>`:''}<div class="heading"><h2>الترتيب التراكمي</h2><span>من المجموعات حتى النهائي</span></div>${rankingRows(leaderboard)}</section><p class="foot">الترشيحات محفوظة في حسابك، ولا يمكن تعديلها بعد وقت الإغلاق.</p>`;
  bind();
}

function bind(){
  document.querySelectorAll('[data-pens]').forEach(x=>x.onchange=()=>{document.querySelector(`[data-pens-box="${x.dataset.pens}"]`).style.display=x.checked?'grid':'none'});
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));
    document.querySelectorAll('.panel').forEach(x=>x.hidden=x.id!==b.dataset.tab);
  });
  document.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{
    const f=fixtures.find(x=>x.id===b.dataset.save);
    savePrediction(roundFor(f),f,b);
  });
}

async function savePrediction(r,f,button){
  const h=Number(document.querySelector(`[data-home="${f.id}"]`).value);
  const a=Number(document.querySelector(`[data-away="${f.id}"]`).value);
  const note=document.querySelector(`[data-note="${f.id}"]`);
  if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h>50||a>50){
    note.className='notice error';note.style.display='block';note.textContent='أدخل نتيجة صحيحة.';return;
  }
  const pensEl=document.querySelector(`[data-pens="${f.id}"]`),predictsPens=!!pensEl?.checked;
  const qualifier=predictsPens?document.querySelector(`[data-qualifier="${f.id}"]`)?.value:scoreWinner(f,h,a);
  const hp=predictsPens?Number(document.querySelector(`[data-home-pens="${f.id}"]`)?.value):null,ap=predictsPens?Number(document.querySelector(`[data-away-pens="${f.id}"]`)?.value):null;
  if(predictsPens&&(h!==a||!qualifier||!Number.isInteger(hp)||!Number.isInteger(ap)||hp===ap)){note.className='notice error';note.style.display='block';note.textContent='للترجيح: اجعل نتيجة المباراة متعادلة، واختر المتأهل وأدخل نتيجة ترجيح صحيحة غير متعادلة.';return;}
  button.disabled=true;
  const payload={participant_id:user.id,fixture_id:f.id,predicted_home:h,predicted_away:a,predicted_winner_team_id:qualifier||null,predicts_penalties:predictsPens,predicted_home_penalties:hp,predicted_away_penalties:ap,updated_at:new Date().toISOString()};
  const old=predictions[f.id];
  const request=old?sb.from('participant_predictions').update(payload).eq('id',old.id).select().single():sb.from('participant_predictions').insert(payload).select().single();
  const {data,error}=await request;
  if(error){note.className='notice error';note.style.display='block';note.textContent='تعذر الحفظ؛ ربما انتهى وقت الترشيح.';button.disabled=false;return;}
  predictions[f.id]=data||{...old,...payload};
  const outcome=h===a?'تعادل':`${h>a?teams[f.home_team_id].name_ar||teams[f.home_team_id].name:teams[f.away_team_id].name_ar||teams[f.away_team_id].name} فائز`;
  note.className='notice';note.style.display='block';note.textContent=`تم الحفظ ✓ ${outcome} ${h}–${a}`;
  button.textContent='تحديث الترشيح';button.disabled=false;
}

async function init(){
  setupBrand();
  let {data:{session}}=await sb.auth.getSession();
  if(!session){const signed=await sb.auth.signInAnonymously();if(signed.error){app.textContent='تعذر بدء الحساب.';return}session=signed.data.session;}
  user=session.user;
  const roundResult=await sb.from('prediction_rounds').select('*').eq('tournament_id',TOURNAMENT_ID).neq('status','draft').order('opens_at');
  if(roundResult.error){app.textContent='تعذر تحميل الجولات.';return;}
  const available=roundResult.data||[],live=available.filter(r=>!r.is_test);
  rounds=live.length?live:(TOURNAMENT_ID===MANSOUR_2027?available.filter(r=>r.is_test):[]);
  if(TOURNAMENT_ID===EUROPE&&!rounds.length){
    app.innerHTML='<div class="waiting" style="margin-top:18px;min-height:120px"><span>🔒</span><span><strong style="display:block;color:#0a1d3a;font-size:17px;margin-bottom:7px">الترشيحات لم تبدأ بعد</strong>تُفتح ترشيحات دوري أبطال أوروبا تلقائيًا عند الوصول إلى دور الـ16.</span></div>';
    return;
  }
  const profileResult=await sb.from('participant_profiles').select('first_name,family_name,participant_code').eq('user_id',user.id).maybeSingle();
  if(!profileResult.data){location.replace(`participant-account.html?next=predictions&tid=${encodeURIComponent(TOURNAMENT_ID)}`);return;}
  profile=profileResult.data;
  await sb.from('participant_tournament_memberships').upsert({participant_id:user.id,tournament_id:TOURNAMENT_ID},{onConflict:'participant_id,tournament_id',ignoreDuplicates:true});
  if(!rounds.length){render();return;}
  const fixtureResult=await sb.from('prediction_fixtures').select('*').in('round_id',rounds.map(r=>r.id)).order('kickoff_at');
  fixtures=fixtureResult.data||[];
  const ids=[...new Set(fixtures.flatMap(f=>[f.home_team_id,f.away_team_id]).filter(Boolean))];
  if(ids.length){const teamResult=await sb.from('teams').select('id,name_ar,name,logo_url').in('id',ids);(teamResult.data||[]).forEach(t=>teams[t.id]=t);}
  if(fixtures.length){const picks=await sb.from('participant_predictions').select('*').eq('participant_id',user.id).in('fixture_id',fixtures.map(f=>f.id));(picks.data||[]).forEach(p=>predictions[p.fixture_id]=p);}
  const leaders=await sb.from('prediction_leaderboard').select('*').eq('tournament_id',TOURNAMENT_ID).order('points',{ascending:false}).order('exact_scores',{ascending:false}).order('correct_winners',{ascending:false});
  leaderboard=leaders.data||[];
  render();
  if(query.get('tab')==='ranking')setTimeout(()=>document.querySelector('[data-tab="ranking"]')?.click(),0);
}

init();
