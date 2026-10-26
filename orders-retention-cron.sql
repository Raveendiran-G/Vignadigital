-- Vigna Digital: permanent order cleanup schedule
-- Run this in Supabase SQL Editor after confirming you want permanent deletion.
-- It runs at 03:00 UTC on the 1st and 16th of each month (roughly every 15 days).
-- It deletes rows older than 15 days from restaurant_orders.
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'vigna-delete-orders-older-than-15-days';

select cron.schedule(
  'vigna-delete-orders-older-than-15-days',
  '0 3 1,16 * *',
  $job$
    delete from public.restaurant_orders
    where created_at < now() - interval '15 days';
  $job$
);
