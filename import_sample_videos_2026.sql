-- استيراد 3 فيديوهات تجريبية من بطولة 2026 القديمة (Mansour Cup Season 13)
-- ⚠️ يفترض هذا السكربت أن بطولة 2026 هي الأقدم إنشاءً (created_at الأصغر) بين البطولات.
--    قبل التنفيذ، تأكد بتشغيل هذا أولاً وتحقق من الاسم:
--    select id, name, name_ar, season_label, created_at from tournaments order by created_at asc;
--    إن لم تكن 2026 هي أول صف، استبدل الجزء (select id from tournaments order by created_at asc limit 1)
--    برقم الـ id الصحيح لبطولة 2026 في كل سطر أدناه.

insert into videos (tournament_id, title, video_type, video_url, description) values
(
  (select id from tournaments order by created_at asc limit 1),
  'دائرة القضاء 0 - 1 نادي مدينة أبوظبي للجولف (A01)',
  'youtube',
  'https://www.youtube.com/embed/infWDSKWLVk',
  'مباراة المجموعة A - الخميس 19 فبراير 2026'
),
(
  (select id from tournaments order by created_at asc limit 1),
  'مكتب التدقيق والتطوير المؤسسي 3 - 0 نادي مدينة أبوظبي للجولف (A03)',
  'youtube',
  'https://www.youtube.com/embed/IWmJXRmFOqo',
  'مباراة المجموعة A - الثلاثاء 24 فبراير 2026'
),
(
  (select id from tournaments order by created_at asc limit 1),
  'دائرة القضاء 2 - 2 مكتب التدقيق والتطوير المؤسسي (A05)',
  'youtube',
  'https://www.youtube.com/embed/uWg2KPhMwNE',
  'مباراة المجموعة A - الأحد 1 مارس 2026'
);
