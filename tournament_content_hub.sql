-- V0.31 - مركز معلومات وإعلام قابل للإظهار والإخفاء لكل بطولة
-- آمن للتشغيل أكثر من مرة، ولا يحذف أي بيانات حالية.

alter table if exists news_items add column if not exists is_visible boolean not null default true;
alter table if exists feed_posts add column if not exists is_visible boolean not null default true;
alter table if exists videos add column if not exists is_visible boolean not null default true;
alter table if exists documents add column if not exists is_visible boolean not null default true;

create table if not exists tournament_content_sections (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  section_key text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tournament_id, section_key),
  constraint tournament_content_sections_key_check check (section_key in (
    'intro','regulations','decisions','instructions','tutorials',
    'news','photos','media_links','media_videos','bulletins'
  ))
);

create table if not exists tournament_resources (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  category text not null,
  media_type text not null,
  title text not null,
  description text,
  file_url text not null,
  thumbnail_url text,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_resources_category_check check (category in ('intro','regulations','decisions','instructions','tutorials')),
  constraint tournament_resources_media_type_check check (media_type in ('pdf','video','link'))
);

create index if not exists idx_tournament_resources_public
  on tournament_resources(tournament_id, category, is_visible, sort_order, created_at desc);

alter table tournament_content_sections enable row level security;
alter table tournament_resources enable row level security;

drop policy if exists "content_sections_public_read" on tournament_content_sections;
create policy "content_sections_public_read" on tournament_content_sections for select using (true);
drop policy if exists "content_sections_authenticated_write" on tournament_content_sections;
create policy "content_sections_authenticated_write" on tournament_content_sections
  for all to authenticated using (true) with check (true);

drop policy if exists "resources_public_read_visible" on tournament_resources;
create policy "resources_public_read_visible" on tournament_resources
  for select to anon using (is_visible=true);
drop policy if exists "resources_authenticated_read" on tournament_resources;
create policy "resources_authenticated_read" on tournament_resources
  for select to authenticated using (true);
drop policy if exists "resources_authenticated_write" on tournament_resources;
create policy "resources_authenticated_write" on tournament_resources
  for all to authenticated using (true) with check (true);

grant select on tournament_content_sections to anon, authenticated;
grant insert, update, delete on tournament_content_sections to authenticated;
grant select on tournament_resources to anon, authenticated;
grant insert, update, delete on tournament_resources to authenticated;

insert into tournament_content_sections (tournament_id,section_key,is_visible,sort_order)
select t.id,s.section_key,true,s.sort_order
from tournaments t
cross join (values
  ('intro',10),('regulations',20),('decisions',30),('instructions',40),('tutorials',50),
  ('news',60),('photos',70),('media_links',80),('media_videos',90),('bulletins',100)
) as s(section_key,sort_order)
on conflict (tournament_id,section_key) do nothing;

create or replace function seed_tournament_content_sections()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into tournament_content_sections (tournament_id,section_key,is_visible,sort_order)
  values
    (new.id,'intro',true,10),(new.id,'regulations',true,20),(new.id,'decisions',true,30),
    (new.id,'instructions',true,40),(new.id,'tutorials',true,50),(new.id,'news',true,60),
    (new.id,'photos',true,70),(new.id,'media_links',true,80),(new.id,'media_videos',true,90),
    (new.id,'bulletins',true,100)
  on conflict (tournament_id,section_key) do nothing;
  return new;
end $$;

drop trigger if exists trg_seed_tournament_content_sections on tournaments;
create trigger trg_seed_tournament_content_sections
after insert on tournaments for each row execute function seed_tournament_content_sections();
