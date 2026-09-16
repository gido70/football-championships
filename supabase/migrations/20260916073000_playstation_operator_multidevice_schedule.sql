-- تسمح مرحلة التجربة لحساب المشغّل التجريبي بالعمل من الهاتف والتطبيق والكمبيوتر.
-- الحسابات التشغيلية المستقبلية تظل مرتبطة بجهاز واحد افتراضيًا.
alter table public.playstation_admins
  add column if not exists allow_multiple_devices boolean not null default false;

update public.playstation_admins
   set allow_multiple_devices=true
 where tournament_id='c983ee0c-4434-470d-b0a2-6e6efe1ad650'
   and display_name='المشغّل التجريبي — الهاتف'
   and role='operator';

create or replace function public.claim_playstation_operator_device(p_tournament_id uuid,p_device_token text)
returns boolean language plpgsql security definer set search_path=public as $$
declare claimed boolean;
begin
  if (select auth.uid()) is null or p_device_token is null or char_length(p_device_token) < 20 then return false; end if;
  update public.playstation_admins
     set device_token=case when allow_multiple_devices then device_token else coalesce(device_token,p_device_token) end,
         device_bound_at=case when allow_multiple_devices then device_bound_at else coalesce(device_bound_at,now()) end
   where tournament_id=p_tournament_id and user_id=(select auth.uid()) and is_active
     and (role='owner' or allow_multiple_devices or device_token is null or device_token=p_device_token)
  returning true into claimed;
  return coalesce(claimed,false);
end $$;
revoke all on function public.claim_playstation_operator_device(uuid,text) from public,anon;
grant execute on function public.claim_playstation_operator_device(uuid,text) to authenticated;

drop policy if exists "playstation operator updates matches" on public.playstation_matches;
create policy "playstation operator updates matches" on public.playstation_matches for update to authenticated
using (exists (
  select 1 from public.playstation_competitions c
  join public.playstation_admins a on a.tournament_id=c.tournament_id
  where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active
    and (a.role='owner' or a.allow_multiple_devices or a.device_token=current_setting('request.headers',true)::jsonb->>'x-ps-device')
))
with check (exists (
  select 1 from public.playstation_competitions c
  join public.playstation_admins a on a.tournament_id=c.tournament_id
  where c.id=competition_id and a.user_id=(select auth.uid()) and a.is_active
    and (a.role='owner' or a.allow_multiple_devices or a.device_token=current_setting('request.headers',true)::jsonb->>'x-ps-device')
));

