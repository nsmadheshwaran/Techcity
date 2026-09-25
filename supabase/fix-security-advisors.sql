-- =====================================================================
--  Clears the two ERROR-level findings on
--  Supabase Dashboard -> Advisors -> Security
--
--    "View public.upcoming_reminders is defined with the SECURITY
--     DEFINER property"
--    "View public.customer_summary is defined with the SECURITY
--     DEFINER property"
--
--  Run once: Supabase Dashboard -> SQL Editor -> paste -> Run.
--
--  Safe on live data: this only redefines two views and re-declares three
--  function settings. No table is touched, no row is read, written or
--  deleted, and nothing is dropped that is not immediately recreated.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Why this matters
--
--  A Postgres view runs with the privileges of whoever CREATED it, not
--  whoever queries it, unless it opts in to security_invoker. Both views
--  below read customers / services / reminders — tables whose row level
--  security policies restrict each row to its owner_id. Because the views
--  bypassed that, any signed-in user who queried them could read EVERY
--  account's rows, not just their own.
--
--  Your app never queries either view (nothing in src/ references them),
--  so this changes no application behaviour. If you would rather not keep
--  them at all, the two DROP statements alone are a complete fix — just
--  delete the CREATE blocks below.
-- ---------------------------------------------------------------------

drop view if exists public.upcoming_reminders;
create view public.upcoming_reminders
  with (security_invoker = on) as
select r.*, c.name as customer_name, c.phone as customer_phone
from public.reminders r
join public.customers c on c.id = r.customer_id
where r.done = false
order by r.due_date;

drop view if exists public.customer_summary;
create view public.customer_summary
  with (security_invoker = on) as
select
  c.id,
  c.owner_id,
  c.code,
  c.name,
  c.phone,
  c.gst_number,
  count(s.id)                                      as total_services,
  coalesce(sum(s.total_amount), 0)                 as total_spent,
  coalesce(sum(s.amount_paid), 0)                  as total_paid,
  greatest(0, coalesce(sum(s.balance), 0))         as outstanding,
  max(s.service_date)                              as last_service_date,
  min(s.next_service_date) filter (where s.next_service_date >= current_date)
                                                   as next_service_date
from public.customers c
left join public.services s
       on s.customer_id = c.id and s.status <> 'Cancelled'
group by c.id;

-- ---------------------------------------------------------------------
--  Also clears the WARN-level "Function Search Path Mutable" findings, if
--  the advisor is showing them. Without a pinned search_path a caller can
--  put their own schema in front of public and have these trigger
--  functions resolve to their tables instead of yours. Behaviour is
--  otherwise identical.
-- ---------------------------------------------------------------------
alter function public.recalculate_service_totals() set search_path = public, pg_temp;
alter function public.sync_service_amount_paid()   set search_path = public, pg_temp;
alter function public.touch_updated_at()           set search_path = public, pg_temp;

-- Re-read the schema so PostgREST does not keep serving a stale cache.
notify pgrst, 'reload schema';
