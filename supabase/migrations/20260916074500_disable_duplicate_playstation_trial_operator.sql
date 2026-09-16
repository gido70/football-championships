-- حساب تجريبي واحد فقط يعمل على أجهزة المستخدم المتعددة.
-- الحساب الاحتياطي القديم يُعطّل ولا يُحذف حتى يمكن استعادته عند الحاجة.
update public.playstation_admins
   set is_active=false
 where tournament_id='c983ee0c-4434-470d-b0a2-6e6efe1ad650'
   and display_name='المشغّل التجريبي — الكمبيوتر'
   and role='operator';

