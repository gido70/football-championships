-- V0.20 — خيارات المحتوى الإعلامي والنشرات متعددة الأعداد
-- آمن للتشغيل أكثر من مرة، ولا يحذف أي بيانات حالية.

alter table if exists feed_posts
  add column if not exists content_category text default 'other',
  add column if not exists source_type text default 'internal',
  add column if not exists source_name text,
  add column if not exists media_orientation text default 'auto',
  add column if not exists is_featured boolean not null default false,
  add column if not exists updated_at timestamptz;

alter table if exists videos
  add column if not exists content_category text default 'other',
  add column if not exists source_type text default 'youtube',
  add column if not exists source_name text,
  add column if not exists media_orientation text default 'auto',
  add column if not exists is_featured boolean not null default false,
  add column if not exists updated_at timestamptz;

alter table if exists documents
  add column if not exists issue_number integer,
  add column if not exists cover_url text,
  add column if not exists updated_at timestamptz;

-- ترقيم الأعداد القديمة لكل بطولة من الأقدم إلى الأحدث عند غياب الرقم.
with ranked as (
  select id,
         row_number() over (
           partition by tournament_id
           order by publish_date asc nulls first, created_at asc
         ) as inferred_issue
  from documents
  where issue_number is null
)
update documents d
set issue_number = ranked.inferred_issue
from ranked
where d.id = ranked.id;

create unique index if not exists idx_documents_tournament_issue
  on documents(tournament_id, issue_number)
  where issue_number is not null;

create index if not exists idx_feed_posts_tournament_category
  on feed_posts(tournament_id, post_type, content_category, created_at desc);

create index if not exists idx_videos_tournament_category
  on videos(tournament_id, content_category, created_at desc);
