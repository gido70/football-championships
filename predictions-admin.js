const ADMIN_PREDICTION_TOURNAMENTS={
  'eee33333-5d2a-4f3b-a981-d4b8f5f86143':'دوري أبطال أوروبا',
  'c983ee0c-4434-470d-b0a2-6e6efe1ad650':'كأس منصور بن زايد 2027'
};
const adminParams=new URLSearchParams(location.search);
const requestedTid=adminParams.get('tid');
const ADMIN_TOURNAMENT_ID=ADMIN_PREDICTION_TOURNAMENTS[requestedTid]?requestedTid:'eee33333-5d2a-4f3b-a981-d4b8f5f86143';
const adminSb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const adminEsc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function loadPredictionStatus(){
  document.querySelectorAll('[data-tid]').forEach(a=>a.classList.toggle('active',a.dataset.tid===ADMIN_TOURNAMENT_ID));
  document.querySelector('.page-title h1').textContent='إدارة ترشيحات '+ADMIN_PREDICTION_TOURNAMENTS[ADMIN_TOURNAMENT_ID];
  document.querySelector('.page-title p').textContent='المباريات والنتائج تنتقل تلقائيًا من إدارة البطولة';
  document.querySelector('a[href^="predictions.html"]').href='predictions.html?tid='+encodeURIComponent(ADMIN_TOURNAMENT_ID);
  document.querySelector('.panel>h3').textContent='حالة المزامنة التلقائية';
  document.querySelector('.panel>.note').textContent='هذه الوحدة تقرأ المباريات الحقيقية ولا تعدّلها.';
  const [settingsResult,roundResult]=await Promise.all([
    adminSb.from('prediction_sync_settings').select('*').eq('tournament_id',ADMIN_TOURNAMENT_ID).maybeSingle(),
    adminSb.from('prediction_rounds').select('*').eq('tournament_id',ADMIN_TOURNAMENT_ID).order('opens_at',{ascending:false})
  ]);
  if(settingsResult.error||roundResult.error){document.getElementById('fixtures').textContent='تعذر تحميل حالة الترشيحات.';return;}
  const setting=settingsResult.data,rounds=roundResult.data||[];
  let fixtures=[];
  if(rounds.length){const result=await adminSb.from('prediction_fixtures').select('id,round_id,is_scored,kickoff_at').in('round_id',rounds.map(r=>r.id));fixtures=result.data||[];}
  const start=setting?.start_mode==='all'?'من أول مباراة':'عند وصول البطولة إلى دور الـ16';
  const cards=rounds.map(r=>{const rows=fixtures.filter(f=>f.round_id===r.id);return `<div class="panel result-card"><h3>${adminEsc(r.name)} ${r.is_test?'— تجربة':''}</h3><p>${rows.length} مباراة · ${rows.filter(f=>f.is_scored).length} نتيجة محتسبة</p><div class="status good">${r.status==='open'?'✓ الجولة مفتوحة للترشيحات':'حالة الجولة: '+adminEsc(r.status)}</div></div>`;}).join('');
  document.getElementById('fixtures').innerHTML=`<div class="panel result-card"><h3>${setting?.enabled?'✅ المزامنة مفعلة':'⏸ المزامنة متوقفة'}</h3><p><strong>بداية الترشيحات:</strong> ${start}</p><p><strong>قفل الترشيح:</strong> قبل المباراة بـ${setting?.lock_minutes??5} دقائق</p></div>${cards||'<div class="panel result-card"><h3>⏳ بانتظار الجدول الحقيقي</h3><p>عند تسجيل مباراة بتاريخ ووقت وفريقين ستظهر هنا وفي صفحة المشاركين تلقائيًا.</p></div>'}`;
}

loadPredictionStatus();
