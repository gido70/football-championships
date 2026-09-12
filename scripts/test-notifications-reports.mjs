import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const scriptsFrom=html=>[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(Boolean);

for(const file of ['match-admin.html','live-desk.html','tournament.html','match-report.html','notification-admin.html']){
  scriptsFrom(read(file)).forEach((source,index)=>new vm.Script(source,{filename:file+'#'+index}));
}
for(const file of ['sw.js','admin-push.js','push-config.js','push-notifications.js'])new vm.Script(read(file),{filename:file});

const tournament=read('tournament.html'),sw=read('sw.js'),matchAdmin=read('match-admin.html'),live=read('live-desk.html'),sql=read('push_notifications.sql'),edge=read('supabase/functions/send-match-notification/index.ts'),report=read('match-report.html');
must(tournament.includes('id="notificationToggle"'),'زر تفعيل التنبيهات غير موجود');
must(!tournament.includes('requestNotifyPermissionOnce'),'ما زال طلب الإذن التلقائي موجودًا');
must(sw.includes("self.addEventListener('push'"),'مستمع Push غير موجود');
must(sw.includes("self.addEventListener('notificationclick'"),'فتح المباراة من التنبيه غير موجود');
for(const event of ['start','goal','yellow_card','red_card','end']){
  must(matchAdmin.includes(`'${event}'`),`إرسال ${event} غير مربوط بإدارة المباراة`);
  must(edge.includes(`'${event}'`),`وظيفة الخادم لا تعرف ${event}`);
}
must(live.includes("['goal','yellow_card','red_card'].includes(type)"),'أحداث مركز اللايف غير مربوطة بالتنبيهات');
must(matchAdmin.includes('id="quickPickerConfirm"'),'زر تأكيد اختيار اللاعب غير موجود');
must(matchAdmin.includes('function quickSelect(')&&matchAdmin.includes('function quickConfirm('),'اختيار اللاعب الآمن غير مكتمل');
must(matchAdmin.includes(".eq('is_active',true)")&&live.includes(".eq('is_active',true)"),'اللاعبون غير النشطين قد يظهرون في اللايف');
must(live.includes('id="playerChoiceGrid"'),'قائمة اللاعبين المرئية غير موجودة في مركز اللايف');
must(live.includes('id="playerSelect" type="hidden"'),'ما زالت قائمة اللاعب المنسدلة ظاهرة في مركز اللايف');
must(live.includes("if(!playerId){toast('اختر اللاعب من البطاقة"),'مركز اللايف يسمح بحفظ حدث دون اختيار بطاقة لاعب');
must(matchAdmin.includes('id="hPlayerCards"')&&matchAdmin.includes('id="aPlayerCards"'),'بطاقات اللاعبين غير موجودة في نموذج إدارة المباراة التفصيلي');
must(matchAdmin.includes('function selectEventPlayer('),'تحديد بطاقة اللاعب في النموذج التفصيلي غير مربوط');
must(matchAdmin.includes('function saveInjurySelection(')&&matchAdmin.includes('id="saveInjuryBtn"'),'الإصابة لا تستخدم الاختيار ثم التأكيد');
must(!matchAdmin.includes('class="inj-check"'),'ما زال حفظ الإصابة الفوري بضغطة واحدة موجودًا');
must(sql.includes('unique(tournament_id,endpoint)'),'منع تكرار الاشتراك غير موجود');
must(sql.includes('event_key text not null unique'),'منع تكرار التنبيه غير موجود');
must(report.includes('الفائز')&&report.includes('الخاسر')&&report.includes('وقت البداية')&&report.includes('حكم المباراة')&&report.includes('المعلّق'),'تقرير المباراة ينقصه أحد الحقول المطلوبة');
must(matchAdmin.includes('referee-page')&&matchAdmin.includes('commentator-page'),'قوالب الحكم والمعلّق غير موجودة');
must(matchAdmin.includes('slice(0,15)'),'حد الصفحة الواحدة للاعبين غير مطبق');
must(matchAdmin.includes('rosters-layout'),'قائمتا الحكم ليستا مثبتتين جنبًا إلى جنب للطباعة');
must(matchAdmin.includes('team-staff-table')&&matchAdmin.includes('coach_name'),'بيانات المدرب والإداري ناقصة من تقرير الحكم');
must(!matchAdmin.includes("select('name_ar,name,committee_logo_url"),'استعلام التقرير ما زال يطلب عمود البطولة غير الموجود name_ar');
must(matchAdmin.includes("select('name,committee_logo_url,cup_logo_url,logo_url,report_color,report_font,report_header_image_url,report_show_logos,report_logos_swapped,show_committee_logo,show_cup_logo')"),'هوية البطولة الكاملة غير مربوطة بالتقارير');
must(matchAdmin.includes(".eq('team_id',cur.home_team_id).eq('is_active',true)")&&matchAdmin.includes(".eq('team_id',cur.away_team_id).eq('is_active',true)"),'التقارير قد تعرض لاعبين غير نشطين');
must(matchAdmin.includes('معلّق المباراة')&&matchAdmin.includes("reportField('commentator','commentator')"),'اسم المعلق وتوقيعه غير موجودين في تقرير الحكم');
must(matchAdmin.includes('الحكم المساعد')&&matchAdmin.includes("reportField('referee2','referee_2')"),'اسم الحكم المساعد غير مربوط بمحضر المباراة');
must(matchAdmin.includes("select('event_type,event_subtype,minute,team_id,player_id,related_player_id,manual_player_name,notes,var_result')")&&matchAdmin.includes('const playerMap=new Map'),'محضر المباراة لا يربط الأحداث بقائمة اللاعبين بصورة آمنة');
must(!matchAdmin.includes("sb.from('match_events').select('*,player:players(name,full_name_ar,number)')"),'محضر المباراة ما زال يستخدم ربط PostgREST غير الصالح للأحداث');
must(matchAdmin.includes("e.minute==null?'—':e.minute"),'المحضر يعرض الدقيقة الفارغة بصيغة null');
must(matchAdmin.includes('نموذج ما قبل المباراة')&&matchAdmin.includes('يؤشّر على الهدف والإنذار والطرد يدويًا'),'تقرير الحكم لا يوضح أنه نموذج يدوي قبل المباراة');
must(!matchAdmin.includes("cur.status==='completed'?`${cur.home_score??0} - ${cur.away_score??0}`:''"),'تقرير الحكم ما زال يطبع النتيجة النهائية تلقائيًا');
must(matchAdmin.includes('style="--team-color:${color}"')&&matchAdmin.includes('border-top:2.5mm solid var(--team-color'),'هوية لون الفريق غير واضحة في صفحة المعلّق');
must(matchAdmin.includes('report-letterhead-banner')&&matchAdmin.includes('report-brand-strip')&&matchAdmin.includes('object-position:center center'),'الترويسة لا تضمن تمركز الصورة ووضوح الشعارات');
must(matchAdmin.includes(".order('match_no',{ascending:true,nullsFirst:false})")&&matchAdmin.includes('if(index>=0)matchNo=index+1'),'رقم المباراة الاحتياطي لا يُشتق تلقائيًا من ترتيب البطولة');
must(matchAdmin.includes('function reportTime(')&&matchAdmin.includes('reportDate(cur.match_date)'),'تاريخ ووقت المباراة غير مربوطين بنماذج الطباعة');
must(matchAdmin.includes('full-score-card')&&matchAdmin.includes('report-kpis')&&matchAdmin.includes('الطاقم التحكيمي والإعلامي'),'التصميم الشامل لمحضر المباراة غير مكتمل');
for(const label of ['الأهداف','البطاقات الصفراء','البطاقات الحمراء','الإصابات','التبديلات','مراجعات VAR','سجل ركلات الترجيح'])must(matchAdmin.includes(label),'محضر المباراة لا يشمل '+label);
must(matchAdmin.includes('full-report-page')&&matchAdmin.includes('overflow:visible'),'محضر المباراة الطويل قد يُقص عند الطباعة');

console.log('notification and report tests passed');
