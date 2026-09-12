-- V0.23 — اشتراكات تنبيهات البطولات وسجل منع التكرار
-- آمن للتشغيل أكثر من مرة، ولا يحذف أي بيانات.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tournament_id,endpoint)
);

create index if not exists idx_push_subscriptions_tournament_active
  on public.push_subscriptions(tournament_id,is_active);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;

create or replace function public.save_push_subscription(
  p_tournament_id uuid,p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if length(coalesce(p_endpoint,''))<20 or length(coalesce(p_endpoint,''))>2048
     or length(coalesce(p_p256dh,''))<20 or length(coalesce(p_auth,''))<8 then
    raise exception 'بيانات الاشتراك غير صالحة';
  end if;
  if not exists(select 1 from public.tournaments where id=p_tournament_id) then raise exception 'البطولة غير موجودة'; end if;
  insert into public.push_subscriptions(tournament_id,endpoint,p256dh,auth,user_agent,is_active,updated_at)
  values(p_tournament_id,p_endpoint,p_p256dh,p_auth,left(p_user_agent,500),true,now())
  on conflict(tournament_id,endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,is_active=true,updated_at=now()
  returning id into v_id;
  return v_id;
end;$$;

create or replace function public.remove_push_subscription(p_tournament_id uuid,p_endpoint text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.push_subscriptions set is_active=false,updated_at=now()
  where tournament_id=p_tournament_id and endpoint=p_endpoint;
  return found;
end;$$;

revoke all on function public.save_push_subscription(uuid,text,text,text,text) from public;
revoke all on function public.remove_push_subscription(uuid,text) from public;
grant execute on function public.save_push_subscription(uuid,text,text,text,text) to anon,authenticated;
grant execute on function public.remove_push_subscription(uuid,text) to anon,authenticated;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  notification_type text not null check(notification_type in ('start','goal','yellow_card','red_card','end')),
  status text not null default 'pending' check(status in ('pending','sent','partial','failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon,authenticated;
