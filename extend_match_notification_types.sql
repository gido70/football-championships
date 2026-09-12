-- Extend match push deliveries to include yellow and red cards.
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_notification_type_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_notification_type_check
  check (notification_type in ('start','goal','yellow_card','red_card','end'));
