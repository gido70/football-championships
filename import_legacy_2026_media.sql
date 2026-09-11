-- استيراد محتوى كأس منصور 2026 القديم إلى البطولة الحالية — قابل لإعادة التشغيل دون تكرار.
-- شغّل v020_media_content.sql أولاً.

do $$
declare tid uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  -- الأعداد الرسمية: العدد 1 هو الأقدم والعدد 14 هو الأحدث.
  insert into documents (tournament_id,issue_number,title,pdf_url,publish_date,description)
  values
    (tid,1,'نشرة الجمعة 20-2-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-02-20.pdf','2026-02-20','تغطية أحداث البطولة'),
    (tid,2,'نشرة السبت 21-2-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-02-21.pdf','2026-02-21','متابعة البطولة'),
    (tid,3,'نشرة الثلاثاء 24-2-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-02-24.pdf','2026-02-24','أبرز أحداث المنافسات'),
    (tid,4,'نشرة الأربعاء 25-2-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-02-25.pdf','2026-02-25','تفاصيل المباريات'),
    (tid,5,'نشرة الخميس 26-2-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-02-26.pdf','2026-02-26','أخبار الفرق والمنافسات'),
    (tid,6,'نشرة الجمعة 27-2-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-02-27.pdf','2026-02-27','حصاد اليوم'),
    (tid,7,'نشرة السبت 28-2-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-02-28.pdf','2026-02-28','مجريات المنافسات'),
    (tid,8,'نشرة الاثنين 2-3-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-03-02.pdf','2026-03-02','متابعة البطولة'),
    (tid,9,'نشرة الثلاثاء 3-3-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-03-03.pdf','2026-03-03','أبرز أحداث المنافسات'),
    (tid,10,'نشرة الأربعاء 4-3-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-03-04.pdf','2026-03-04','تفاصيل المباريات'),
    (tid,11,'نشرة الخميس 5-3-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-03-05.pdf','2026-03-05','أخبار الفرق والمنافسات'),
    (tid,12,'نشرة السبت 7-3-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-03-07.pdf','2026-03-07','مجريات المنافسات'),
    (tid,13,'نشرة الاثنين 9-3-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-03-09.pdf','2026-03-09','متابعة البطولة'),
    (tid,14,'نشرة الأربعاء 11-3-2026','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/news/news-2026-03-11.pdf','2026-03-11','النشرة الختامية للنسخة الثالثة عشرة')
  on conflict (tournament_id,issue_number) where issue_number is not null do update set
    title=excluded.title,pdf_url=excluded.pdf_url,publish_date=excluded.publish_date,
    description=excluded.description,updated_at=now();

  update documents set cover_url=null,updated_at=now()
  where tournament_id=tid and pdf_url like 'https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/%';

  -- تحديث الفيديو الموجود مسبقًا ثم إضافة البقية إن لم تكن موجودة.
  update videos set title='المؤتمر الصحفي والقرعة',thumbnail_url='https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/img/draw-video.jpg',description='تغطية المؤتمر الصحفي وقرعة البطولة والإعلان الرسمي عن تفاصيل النسخة الثالثة عشرة.',content_category='press_conference',source_type='youtube',source_name='ديوان سبورت',media_orientation='landscape',updated_at=now()
    where tournament_id=tid and video_url like '%AZ3hvX2xNes%';

  insert into videos (tournament_id,title,video_type,video_url,thumbnail_url,description,content_category,source_type,source_name,media_orientation)
  select tid,'المؤتمر الصحفي والقرعة','youtube','https://www.youtube.com/watch?v=AZ3hvX2xNes','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/img/draw-video.jpg','تغطية المؤتمر الصحفي وقرعة البطولة والإعلان الرسمي عن تفاصيل النسخة الثالثة عشرة.','press_conference','youtube','ديوان سبورت','landscape'
  where not exists(select 1 from videos where tournament_id=tid and video_url like '%AZ3hvX2xNes%');

  insert into videos (tournament_id,title,video_type,video_url,thumbnail_url,description,content_category,source_type,source_name,media_orientation)
  select tid,'حفل افتتاح بطولة كأس منصور بن زايد 2026','mp4','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/videos/opening.mp4','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/img/opening-video.jpg','لقطات من مراسم الافتتاح والأجواء المصاحبة لانطلاق البطولة.','opening','internal','إدارة البطولة','landscape'
  where not exists(select 1 from videos where tournament_id=tid and video_url like '%assets/videos/opening.mp4');

  insert into videos (tournament_id,title,video_type,video_url,thumbnail_url,description,content_category,source_type,source_name,media_orientation)
  select tid,'زيارة الشيخ منصور بن زايد لمنافسات البطولة','mp4','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/videos/sheikh-visit.mp4','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/img/sheikh-visit-video.png','لقطات خاصة من الزيارة ومتابعة مجريات البطولة من أرض الملعب.','official_visit','internal','إدارة البطولة','landscape'
  where not exists(select 1 from videos where tournament_id=tid and video_url like '%assets/videos/sheikh-visit.mp4');

  insert into videos (tournament_id,title,video_type,video_url,thumbnail_url,description,content_category,source_type,source_name,media_orientation)
  select tid,'ملخص المباراة النهائية وتتويج البطل','youtube','https://www.youtube.com/watch?v=1fD9tHCz48s','https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/img/final-highlights-video.jpg','أبرز لقطات النهائي وتتويج البطل في ختام البطولة.','highlights','youtube','ديوان سبورت','landscape'
  where not exists(select 1 from videos where tournament_id=tid and video_url like '%1fD9tHCz48s%');

  -- ألبومات الصور المضغوطة للهاتف (10 صور لكل ألبوم).
  insert into feed_posts (tournament_id,post_type,title,caption,image_urls,content_category,source_type,source_name)
  select tid,'image',v.title,v.caption,array(select 'https://raw.githubusercontent.com/gido70/Championship-Mansour-Bin-Zaid-Cup--2026/main/assets/gallery/'||v.folder||'/img'||g||'.jpg' from generate_series(1,v.image_count) g),v.category,'internal','إدارة البطولة'
  from (values
    ('حفل الافتتاح','لقطات من مراسم الافتتاح والأجواء المصاحبة لانطلاق البطولة.','opening','opening',10),
    ('فرق البطولة','صور الفرق المشاركة في بطولة كأس منصور بن زايد 2026.','teams','teams',9),
    ('أجواء البطولة','لقطات متنوعة من أجواء البطولة داخل وخارج الملعب.','atmosphere','fans',10),
    ('من المدرجات','تفاعل الجمهور ومتابعة المباريات من المدرجات.','stands','fans',10),
    ('التتويج وختام البطولة','لحظات التتويج وتسليم الكأس والجوائز.','trophy','trophy',10),
    ('بطولة البلايستيشن','صور بطولة البلايستيشن المصاحبة لفعاليات البطولة.','playstation','other',10)
  ) as v(title,caption,folder,category,image_count)
  where not exists(select 1 from feed_posts f where f.tournament_id=tid and f.post_type='image' and f.title=v.title);

  update tournaments set
    instagram_url=coalesce(instagram_url,'https://www.instagram.com/diwan_sports_uae'),
    youtube_url=coalesce(youtube_url,'https://youtube.com/@diwansports')
  where id=tid;
end $$;
