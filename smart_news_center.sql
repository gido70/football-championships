-- V0.36 - إعدادات ومسار تحرير مركز الأخبار الذكي
-- آمن للتشغيل أكثر من مرة ولا يحذف الأخبار أو المباريات الحالية.

alter table if exists public.news_items add column if not exists source_type text not null default 'legacy';
alter table if exists public.news_items add column if not exists category text not null default 'official';
alter table if exists public.news_items add column if not exists editorial_status text not null default 'published';
alter table if exists public.news_items add column if not exists is_featured boolean not null default false;
alter table if exists public.news_items add column if not exists is_verified boolean not null default true;
alter table if exists public.news_items add column if not exists dedupe_key text;

do $$ begin
  alter table public.news_items add constraint news_items_source_type_check
    check (source_type in ('legacy','automatic','manual','external'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.news_items add constraint news_items_category_check
    check (category in ('official','matches','teams','players','awards','external'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.news_items add constraint news_items_editorial_status_check
    check (editorial_status in ('draft','review','ready','published','hidden'));
exception when duplicate_object then null; end $$;

drop index if exists public.idx_news_items_dedupe;
create unique index idx_news_items_dedupe
  on public.news_items(tournament_id,dedupe_key);
create index if not exists idx_news_items_center_public
  on public.news_items(tournament_id,editorial_status,is_visible,sort_order,published_at desc);

create table if not exists public.smart_news_settings (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  mode text not null default 'review',
  results_enabled boolean not null default true,
  round_summaries_enabled boolean not null default true,
  qualification_enabled boolean not null default true,
  awards_enabled boolean not null default true,
  external_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint smart_news_settings_mode_check check (mode in ('automatic','review','off'))
);

alter table public.smart_news_settings enable row level security;
drop policy if exists "smart_news_settings_public_read" on public.smart_news_settings;
create policy "smart_news_settings_public_read" on public.smart_news_settings for select using (true);
drop policy if exists "smart_news_settings_authenticated_write" on public.smart_news_settings;
create policy "smart_news_settings_authenticated_write" on public.smart_news_settings
  for all to authenticated using (true) with check (true);
grant select on public.smart_news_settings to anon,authenticated;
grant insert,update,delete on public.smart_news_settings to authenticated;

-- البطولات الموجودة تستمر تلقائيًا حتى لا تختفي تغطيتها بعد الترقية.
insert into public.smart_news_settings(tournament_id,mode)
select id,'automatic' from public.tournaments
on conflict (tournament_id) do nothing;

create or replace function public.seed_smart_news_settings()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.smart_news_settings(tournament_id,mode)
  values(new.id,'review') on conflict (tournament_id) do nothing;
  return new;
end $$;
drop trigger if exists trg_seed_smart_news_settings on public.tournaments;
create trigger trg_seed_smart_news_settings
after insert on public.tournaments for each row execute function public.seed_smart_news_settings();
