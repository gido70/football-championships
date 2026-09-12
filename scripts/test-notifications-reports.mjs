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
must(sql.includes('unique(tournament_id,endpoint)'),'منع تكرار الاشتراك غير موجود');
must(sql.includes('event_key text not null unique'),'منع تكرار التنبيه غير موجود');
must(report.includes('الفائز')&&report.includes('الخاسر')&&report.includes('وقت البداية')&&report.includes('حكم المباراة')&&report.includes('المعلّق'),'تقرير المباراة ينقصه أحد الحقول المطلوبة');
must(matchAdmin.includes('referee-page')&&matchAdmin.includes('commentator-page'),'قوالب الحكم والمعلّق غير موجودة');
must(matchAdmin.includes('slice(0,15)'),'حد الصفحة الواحدة للاعبين غير مطبق');
must(matchAdmin.includes('rosters-layout'),'قائمتا الحكم ليستا مثبتتين جنبًا إلى جنب للطباعة');
must(matchAdmin.includes('team-staff-table')&&matchAdmin.includes('coach_name'),'بيانات المدرب والإداري ناقصة من تقرير الحكم');

console.log('notification and report tests passed');
