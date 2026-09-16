(function(){
  'use strict';

  const MANSOUR_2027='c983ee0c-4434-470d-b0a2-6e6efe1ad650';
  const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const stageNames={group:'دور المجموعات',round_of_16:'دور الـ16',quarter_final:'ربع النهائي',semi_final:'نصف النهائي',third_place:'المركز الثالث',final:'النهائي'};
  const statusNames={scheduled:'مجدولة',live:'مباشرة',completed:'منتهية'};
  const eventNames={goal:'هدف',yellow_card:'بطاقة صفراء',red_card:'بطاقة حمراء',substitution:'تبديل',injury:'إصابة'};
  const subtypeNames={own_goal:'هدف عكسي',penalty:'ركلة جزاء',missed_penalty:'ركلة جزاء ضائعة'};

  function ensureReady(tournamentId){
    if(tournamentId!==MANSOUR_2027)throw new Error('نسخة الطوارئ متاحة لكأس منصور 2027 والبلايستيشن المصاحب فقط');
    if(!window.XLSX)throw new Error('تعذر تحميل محرّك Excel. اتصل بالإنترنت ثم أعد فتح الصفحة.');
  }
  function clean(v){return v===null||v===undefined?'':v}
  function labelDate(v){
    if(!v)return '';
    const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);
    return new Intl.DateTimeFormat('ar-AE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);
  }
  function stamp(){
    const d=new Date(),p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
  }
  function safeName(v){return String(v||'نسخة-الطوارئ').replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'-')}
  function mapBy(rows,key='id'){return Object.fromEntries((rows||[]).map(x=>[x[key],x]))}
  function personName(p){return p?.full_name_ar||p?.name||'—'}
  function teamName(t){return t?.name_ar||t?.name||'—'}
  function resultText(a,b){return a===null||a===undefined||b===null||b===undefined?'':`${a} - ${b}`}
  function statusText(v){return statusNames[v]||clean(v)}
  function stageText(v){return stageNames[v]||clean(v)}

  function rowsSheet(rows,headers,widths){
    const data=rows&&rows.length?rows:[Object.fromEntries(headers.map(h=>[h,'']))];
    const ws=XLSX.utils.json_to_sheet(data,{header:headers});
    ws['!cols']=headers.map((h,i)=>({wch:(widths&&widths[i])||Math.max(12,Math.min(30,String(h).length+8))}));
    ws['!views']=[{RTL:true}];
    ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,data.length),c:headers.length-1}})};
    ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
    return ws;
  }
  function infoSheet(title,subtitle,counts){
    const rows=[
      ['نسخة الطوارئ',title],['الوصف',subtitle],['وقت إنشاء النسخة',labelDate(new Date())],
      ['طريقة الاستخدام','احفظ الملف على الكمبيوتر أو الهاتف بعد كل مباراة. عند تعطل المنصة، استخدم ورقة «إدخال الطوارئ» لتسجيل المباراة التالية يدويًا.'],
      ['تنبيه','هذا الملف لقطة مستقلة للقراءة والحفظ؛ لا يزامن أو يغيّر بيانات المنصة.'],
      ...Object.entries(counts||{}).map(([k,v])=>[k,v])
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:24},{wch:90}];ws['!views']=[{RTL:true}];return ws;
  }
  function append(wb,ws,name){XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31))}
  function download(wb,filename){
    wb.Props={...(wb.Props||{}),Title:filename,Subject:'نسخة طوارئ مستقلة',Author:'منصة البطولات',CreatedDate:new Date()};
    const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array',compression:true});
    const blob=new Blob([bytes],{type:MIME}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    return {filename,size:blob.size};
  }
  async function query(sb,table,filterColumn,filterValue,order){
    let q=sb.from(table).select('*').eq(filterColumn,filterValue);
    if(order)q=q.order(order,{ascending:true,nullsFirst:false});
    const {data,error}=await q;if(error)throw new Error(`تعذر قراءة ${table}: ${error.message}`);return data||[];
  }
  async function optionalQuery(sb,table,filterColumn,filterValue,order){
    try{return await query(sb,table,filterColumn,filterValue,order)}catch(error){console.warn('[emergency-excel]',error.message);return []}
  }
  async function optionalByMatches(sb,table,matchIds){
    if(!matchIds.length)return [];
    try{const {data,error}=await sb.from(table).select('*').in('match_id',matchIds);if(error)throw error;return data||[]}
    catch(error){console.warn('[emergency-excel]',`تعذر قراءة ${table}: ${error.message}`);return []}
  }
  function footballStandings(teams,matches){
    const stats={};teams.forEach(t=>stats[t.id]={المجموعة:t.group_code||'',الفريق:teamName(t),لعب:0,فوز:0,تعادل:0,خسارة:0,له:0,عليه:0,الفارق:0,النقاط:0});
    matches.filter(m=>m.status==='completed'&&m.home_team_id&&m.away_team_id&&m.home_score!=null&&m.away_score!=null).forEach(m=>{
      const h=stats[m.home_team_id],a=stats[m.away_team_id];if(!h||!a)return;
      const hs=+m.home_score,as=+m.away_score;h.لعب++;a.لعب++;h.له+=hs;h.عليه+=as;a.له+=as;a.عليه+=hs;
      if(hs>as){h.فوز++;a.خسارة++;h.النقاط+=3}else if(as>hs){a.فوز++;h.خسارة++;a.النقاط+=3}else{h.تعادل++;a.تعادل++;h.النقاط++;a.النقاط++}
    });
    Object.values(stats).forEach(s=>s.الفارق=s.له-s.عليه);
    const groups={};Object.values(stats).forEach(s=>{const g=s.المجموعة||'بلا مجموعة';(groups[g]||(groups[g]=[])).push(s)});
    return Object.entries(groups).sort().flatMap(([g,list])=>list.sort((a,b)=>b.النقاط-a.النقاط||b.الفارق-a.الفارق||b.له-a.له||a.الفريق.localeCompare(b.الفريق,'ar')).map((s,i)=>({المجموعة:g,المركز:i+1,...s})));
  }
  function psStandings(comp,people,matches){
    const stats={};people.forEach(p=>stats[p.id]={المجموعة:p.group_code||'',الرقم:p.participant_no||'',المشارك:p.name,لعب:0,فوز:0,تعادل:0,خسارة:0,له:0,عليه:0,الفارق:0,النقاط:0});
    matches.filter(m=>m.stage==='group'&&m.status==='completed'&&m.player1_id&&m.player2_id&&m.score1!=null&&m.score2!=null).forEach(m=>{
      const a=stats[m.player1_id],b=stats[m.player2_id];if(!a||!b)return;
      const x=+m.score1,y=+m.score2;a.لعب++;b.لعب++;a.له+=x;a.عليه+=y;b.له+=y;b.عليه+=x;
      if(x>y){a.فوز++;b.خسارة++;a.النقاط+=+(comp.win_points??3);b.النقاط+=+(comp.loss_points??0)}else if(y>x){b.فوز++;a.خسارة++;b.النقاط+=+(comp.win_points??3);a.النقاط+=+(comp.loss_points??0)}else{a.تعادل++;b.تعادل++;a.النقاط+=+(comp.draw_points??1);b.النقاط+=+(comp.draw_points??1)}
    });
    Object.values(stats).forEach(s=>s.الفارق=s.له-s.عليه);
    const groups={};Object.values(stats).forEach(s=>{const g=s.المجموعة||'بلا مجموعة';(groups[g]||(groups[g]=[])).push(s)});
    return Object.entries(groups).sort().flatMap(([g,list])=>list.sort((a,b)=>b.النقاط-a.النقاط||b.الفارق-a.الفارق||b.له-a.له||a.المشارك.localeCompare(b.المشارك,'ar')).map((s,i)=>({المجموعة:g,المركز:i+1,...s})));
  }

  async function exportMansour2027(sb,tournamentId=MANSOUR_2027){
    ensureReady(tournamentId);
    const [{data:t,error:te},teams,players,matches,events,varEvents,awards]=await Promise.all([
      sb.from('tournaments').select('id,name,name_ar,season_label').eq('id',tournamentId).single(),
      query(sb,'teams','tournament_id',tournamentId,'name'),query(sb,'players','tournament_id',tournamentId,'number'),
      query(sb,'matches','tournament_id',tournamentId,'match_no'),query(sb,'match_events','tournament_id',tournamentId,'created_at'),
      optionalQuery(sb,'match_var_events','tournament_id',tournamentId,'created_at'),
      optionalQuery(sb,'tournament_awards','tournament_id',tournamentId)
    ]);
    if(te)throw new Error('تعذر قراءة بيانات البطولة: '+te.message);
    const matchIds=matches.map(m=>m.id);
    const [lineups,missed,shootout]=await Promise.all([
      optionalByMatches(sb,'match_lineups',matchIds),optionalByMatches(sb,'match_penalties_missed',matchIds),optionalByMatches(sb,'match_penalty_shootout',matchIds)
    ]);
    const tm=mapBy(teams),pm=mapBy(players),mm=mapBy(matches),wb=XLSX.utils.book_new(),title=(t?.name_ar||t?.name||'كأس منصور')+(t?.season_label?' - '+t.season_label:'');
    append(wb,infoSheet(title,'نسخة الطوارئ الكاملة لكأس منصور 2027',{الفرق:teams.length,اللاعبون:players.length,المباريات:matches.length,'المباريات المنتهية':matches.filter(x=>x.status==='completed').length,الأحداث:events.length}),'دليل النسخة');
    const matchRows=matches.map(m=>({'رقم المباراة':m.match_no??'',المرحلة:stageText(m.round_name||m.stage_code),المجموعة:m.group_code||'',التاريخ:m.match_date||'',الوقت:m.match_time||'','الفريق الأول':teamName(tm[m.home_team_id]),'نتيجة الأول':clean(m.home_score),'نتيجة الثاني':clean(m.away_score),'الفريق الثاني':teamName(tm[m.away_team_id]),'ركلات الأول':clean(m.home_penalties),'ركلات الثاني':clean(m.away_penalties),الحالة:statusText(m.status),الملعب:m.venue_name||m.venue||'',الحكم1:m.referee_1||'',الحكم2:m.referee_2||'',المعلق:m.commentator||'','أفضل لاعب':personName(pm[m.player_of_match_id]),ملاحظات:m.notes||''}));
    append(wb,rowsSheet(matchRows,['رقم المباراة','المرحلة','المجموعة','التاريخ','الوقت','الفريق الأول','نتيجة الأول','نتيجة الثاني','الفريق الثاني','ركلات الأول','ركلات الثاني','الحالة','الملعب','الحكم1','الحكم2','المعلق','أفضل لاعب','ملاحظات']),'المباريات');
    append(wb,rowsSheet(footballStandings(teams,matches),['المجموعة','المركز','الفريق','لعب','فوز','تعادل','خسارة','له','عليه','الفارق','النقاط']),'ترتيب المجموعات');
    append(wb,rowsSheet(teams.map(t=>({الفريق:teamName(t),الاسم_المختصر:t.short_name||'',المجموعة:t.group_code||'',المدرب:t.coach_name||'',الإداري:t.manager_name||t.submitted_by_name||'',نشط:t.is_active===false?'لا':'نعم'})),['الفريق','الاسم_المختصر','المجموعة','المدرب','الإداري','نشط']),'الفرق');
    append(wb,rowsSheet(players.map(p=>({الاسم:personName(p),الفريق:teamName(tm[p.team_id]),الرقم:p.number??p.shirt_number??'',الجنسية:p.nationality||'',المركز:p.position||p.role||'',حارس:p.is_goalkeeper?'نعم':'لا',نشط:p.is_active===false?'لا':'نعم',مصاب:p.is_injured?'نعم':'لا','تفاصيل الإصابة':p.injury_note||'','إيقاف متبقٍ':p.suspended_matches_remaining||0,الحالة:p.submission_status||''})),['الاسم','الفريق','الرقم','الجنسية','المركز','حارس','نشط','مصاب','تفاصيل الإصابة','إيقاف متبقٍ','الحالة']),'اللاعبون');
    const nationalityCount={};players.forEach(p=>{const n=(p.nationality||'غير محددة').trim()||'غير محددة';nationalityCount[n]=(nationalityCount[n]||0)+1});
    append(wb,rowsSheet(Object.entries(nationalityCount).sort((a,b)=>b[1]-a[1]).map(([n,c],i)=>({الترتيب:i+1,الجنسية:n,'عدد اللاعبين':c})),['الترتيب','الجنسية','عدد اللاعبين']),'الجنسيات');
    const eventRows=events.map((e,i)=>({التسلسل:i+1,'رقم المباراة':mm[e.match_id]?.match_no??'',المرحلة:stageText(mm[e.match_id]?.round_name),المجموعة:mm[e.match_id]?.group_code||'',الدقيقة:clean(e.minute),الحدث:eventNames[e.event_type]||e.event_type||'',التفصيل:subtypeNames[e.event_subtype]||e.event_subtype||'',اللاعب:personName(pm[e.player_id])!=='—'?personName(pm[e.player_id]):e.manual_player_name||'',اللاعب_المرتبط:personName(pm[e.related_player_id])!=='—'?personName(pm[e.related_player_id]):'',الفريق:teamName(tm[e.team_id]),ملاحظات:e.notes||'',وقت_التسجيل:labelDate(e.created_at)}));
    append(wb,rowsSheet(eventRows,['التسلسل','رقم المباراة','المرحلة','المجموعة','الدقيقة','الحدث','التفصيل','اللاعب','اللاعب_المرتبط','الفريق','ملاحظات','وقت_التسجيل']),'سجل الأحداث');
    append(wb,rowsSheet(eventRows.filter(x=>x.الحدث==='هدف'),['التسلسل','رقم المباراة','الدقيقة','التفصيل','اللاعب','الفريق','ملاحظات']),'الأهداف');
    append(wb,rowsSheet(eventRows.filter(x=>x.الحدث==='بطاقة صفراء'||x.الحدث==='بطاقة حمراء'),['التسلسل','رقم المباراة','الدقيقة','الحدث','اللاعب','الفريق','ملاحظات']),'البطاقات');
    const scorerCount={};eventRows.filter(x=>x.الحدث==='هدف'&&x.التفصيل!=='هدف عكسي'&&x.اللاعب).forEach(x=>{const k=x.اللاعب+'|'+x.الفريق;scorerCount[k]=(scorerCount[k]||0)+1});
    append(wb,rowsSheet(Object.entries(scorerCount).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>{const [n,team]=k.split('|');return{الترتيب:i+1,اللاعب:n,الفريق:team,الأهداف:v}}),['الترتيب','اللاعب','الفريق','الأهداف']),'الهدافون');
    append(wb,rowsSheet(varEvents.map(v=>({'رقم المباراة':mm[v.match_id]?.match_no??'',الدقيقة:clean(v.minute),الفريق:teamName(tm[v.team_id]),النوع:v.var_type||'',القرار:v.var_result||'',ملاحظات:v.notes||'',وقت_التسجيل:labelDate(v.created_at)})),['رقم المباراة','الدقيقة','الفريق','النوع','القرار','ملاحظات','وقت_التسجيل']),'VAR');
    append(wb,rowsSheet(lineups.map(l=>({'رقم المباراة':mm[l.match_id]?.match_no??'',الفريق:teamName(tm[l.team_id]),اللاعب:personName(pm[l.player_id]),أساسي:l.is_starting?'نعم':'لا',القائد:l.is_captain?'نعم':'لا',حارس:l.is_goalkeeper?'نعم':'لا'})),['رقم المباراة','الفريق','اللاعب','أساسي','القائد','حارس']),'التشكيلات');
    append(wb,rowsSheet(missed.map(x=>({'رقم المباراة':mm[x.match_id]?.match_no??'',الفريق:teamName(tm[x.team_id]),اللاعب:personName(pm[x.player_id]),الدقيقة:clean(x.minute),ملاحظات:x.notes||''})),['رقم المباراة','الفريق','اللاعب','الدقيقة','ملاحظات']),'جزاء ضائعة');
    append(wb,rowsSheet(shootout.map(x=>({'رقم المباراة':mm[x.match_id]?.match_no??'',الفريق:teamName(tm[x.team_id]),اللاعب:personName(pm[x.player_id]),الترتيب:x.kick_order??'',النتيجة:x.result||''})),['رقم المباراة','الفريق','اللاعب','الترتيب','النتيجة']),'ركلات الترجيح');
    append(wb,rowsSheet(matches.map(m=>({'رقم المباراة':m.match_no??'','الفريق الأول':teamName(tm[m.home_team_id]),النتيجة:resultText(m.home_score,m.away_score),'الفريق الثاني':teamName(tm[m.away_team_id]),'أفضل لاعب':personName(pm[m.player_of_match_id])})),['رقم المباراة','الفريق الأول','النتيجة','الفريق الثاني','أفضل لاعب']),'أفضل لاعب');
    const refs={},commentators={};matches.forEach(m=>{[m.referee_1,m.referee_2].filter(Boolean).forEach(n=>refs[n]=(refs[n]||0)+1);if(m.commentator)commentators[m.commentator]=(commentators[m.commentator]||0)+1});
    append(wb,rowsSheet([...Object.entries(refs).map(([n,c])=>({الدور:'حكم',الاسم:n,'عدد المباريات':c})),...Object.entries(commentators).map(([n,c])=>({الدور:'معلّق',الاسم:n,'عدد المباريات':c}))].sort((a,b)=>b['عدد المباريات']-a['عدد المباريات']),['الدور','الاسم','عدد المباريات']),'الحكام والمعلقون');
    append(wb,rowsSheet(awards.map(a=>({الجائزة:a.title||a.award_key||'',الفائز:a.winner_name||personName(pm[a.winner_player_id]),الفريق:teamName(tm[a.winner_team_id])})),['الجائزة','الفائز','الفريق']),'جوائز البطولة');
    const emergency=matches.map(m=>({'رقم المباراة':m.match_no??'',التاريخ:m.match_date||'',الوقت:m.match_time||'',المرحلة:stageText(m.round_name),المجموعة:m.group_code||'','الفريق الأول':teamName(tm[m.home_team_id]),'نتيجة الأول':clean(m.home_score),'نتيجة الثاني':clean(m.away_score),'الفريق الثاني':teamName(tm[m.away_team_id]),الأهداف:'',الصفراء:'',الحمراء:'',VAR:'','أفضل لاعب':'',الحكم:'',المعلق:'',ملاحظات:''}));
    append(wb,rowsSheet(emergency,['رقم المباراة','التاريخ','الوقت','المرحلة','المجموعة','الفريق الأول','نتيجة الأول','نتيجة الثاني','الفريق الثاني','الأهداف','الصفراء','الحمراء','VAR','أفضل لاعب','الحكم','المعلق','ملاحظات'],[12,14,12,18,12,22,12,12,22,35,28,28,28,25,22,22,35]),'إدخال الطوارئ');
    return download(wb,`${safeName(title)}-نسخة-طوارئ-${stamp()}.xlsx`);
  }

  async function exportPlaystation(sb,tournamentId=MANSOUR_2027){
    ensureReady(tournamentId);
    const {data:comp,error}=await sb.from('playstation_competitions').select('*').eq('tournament_id',tournamentId).single();
    if(error||!comp)throw new Error('تعذر قراءة بطولة البلايستيشن');
    const [people,matches]=await Promise.all([query(sb,'playstation_participants','competition_id',comp.id,'participant_no'),query(sb,'playstation_matches','competition_id',comp.id,'match_order')]);
    const pm=mapBy(people),wb=XLSX.utils.book_new(),title=comp.title||'بطولة البلايستيشن 2027';
    append(wb,infoSheet(title,comp.subtitle||'الفعالية المصاحبة لكأس منصور 2027',{المشاركون:people.length,المباريات:matches.length,'المباريات المباشرة':matches.filter(x=>x.status==='live').length,'المباريات المنتهية':matches.filter(x=>x.status==='completed').length}),'دليل النسخة');
    const matchRows=matches.map((m,i)=>({الترتيب:m.match_order??i+1,المرحلة:stageText(m.stage),المجموعة:m.group_code||'',الجولة:m.round_no||'',الموعد:labelDate(m.scheduled_at),الجهاز:m.station_no||'',الدفعة:m.wave_no||'','المشارك الأول':pm[m.player1_id]?.name||'','رقم الأول':pm[m.player1_id]?.participant_no||'','نتيجة الأول':clean(m.score1),'نتيجة الثاني':clean(m.score2),'رقم الثاني':pm[m.player2_id]?.participant_no||'','المشارك الثاني':pm[m.player2_id]?.name||'','ترجيح الأول':clean(m.penalties1),'ترجيح الثاني':clean(m.penalties2),الحالة:statusText(m.status),'بدأ فعليًا':labelDate(m.started_at),'اكتمل':labelDate(m.completed_at)}));
    append(wb,rowsSheet(matchRows,['الترتيب','المرحلة','المجموعة','الجولة','الموعد','الجهاز','الدفعة','المشارك الأول','رقم الأول','نتيجة الأول','نتيجة الثاني','رقم الثاني','المشارك الثاني','ترجيح الأول','ترجيح الثاني','الحالة','بدأ فعليًا','اكتمل']),'المباريات');
    append(wb,rowsSheet(psStandings(comp,people,matches),['المجموعة','المركز','الرقم','المشارك','لعب','فوز','تعادل','خسارة','له','عليه','الفارق','النقاط']),'ترتيب المجموعات');
    append(wb,rowsSheet(people.map(p=>({الرقم:p.participant_no||'',المشارك:p.name,الاسم_داخل_اللعبة:p.nickname||'',المجموعة:p.group_code||'',ترتيب_الإدخال:p.sort_order??'',صورة:p.photo_url||p.photo_path?'مرفقة':'لا توجد','موافقة_النشر':p.photo_public?'نعم':'لا'})),['الرقم','المشارك','الاسم_داخل_اللعبة','المجموعة','ترتيب_الإدخال','صورة','موافقة_النشر']),'المشاركون');
    append(wb,rowsSheet(matchRows.filter(m=>m.المرحلة!=='دور المجموعات'),['الترتيب','المرحلة','الموعد','المشارك الأول','نتيجة الأول','نتيجة الثاني','المشارك الثاني','الحالة']),'الأدوار النهائية');
    const final=matches.filter(m=>m.stage==='final'&&m.status==='completed').sort((a,b)=>(b.completed_at||'').localeCompare(a.completed_at||''))[0];
    let champion='';if(final&&final.score1!=null&&final.score2!=null){champion=final.score1>final.score2?pm[final.player1_id]?.name:final.score2>final.score1?pm[final.player2_id]?.name:(final.penalties1??-1)>(final.penalties2??-1)?pm[final.player1_id]?.name:(final.penalties2??-1)>(final.penalties1??-1)?pm[final.player2_id]?.name:''}
    append(wb,rowsSheet([{البطل:champion||'لم يُحسم بعد','المباراة النهائية':final?`${pm[final.player1_id]?.name||''} ${resultText(final.score1,final.score2)} ${pm[final.player2_id]?.name||''}`:'لم تُلعب بعد','وقت الاعتماد':final?labelDate(final.completed_at):''}],['البطل','المباراة النهائية','وقت الاعتماد']),'البطل');
    const emergency=matches.map((m,i)=>({الترتيب:m.match_order??i+1,اليوم:labelDate(m.scheduled_at),الجهاز:m.station_no||'',المرحلة:stageText(m.stage),المجموعة:m.group_code||'','المشارك الأول':pm[m.player1_id]?.name||'','نتيجة الأول':clean(m.score1),'نتيجة الثاني':clean(m.score2),'المشارك الثاني':pm[m.player2_id]?.name||'',الحالة:statusText(m.status),ملاحظات:''}));
    append(wb,rowsSheet(emergency,['الترتيب','اليوم','الجهاز','المرحلة','المجموعة','المشارك الأول','نتيجة الأول','نتيجة الثاني','المشارك الثاني','الحالة','ملاحظات'],[12,22,10,18,12,28,12,12,28,14,35]),'إدخال الطوارئ');
    return download(wb,`${safeName(title)}-نسخة-طوارئ-${stamp()}.xlsx`);
  }

  window.EmergencyExcel={MANSOUR_2027,exportMansour2027,exportPlaystation};
})();
