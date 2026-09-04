-- =====================================================================
--  TECH CITY TECHNOLOGY — Customer & Service Management System
--  PostgreSQL / Supabase schema
-- =====================================================================
--
--  The application ships working out of the box with a local IndexedDB
--  database (see src/lib/db.ts) — this file is the equivalent relational
--  schema for teams that want a shared, multi-device Supabase backend.
--
--  How to apply:
--    Supabase Dashboard → SQL Editor → paste this file → Run
--
--  Relationships:
--    customers 1─┬─* services ─┬─* service_parts
--                │             └─* payments
--                ├─* equipment
--                └─* reminders
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Sequences that back the human-readable codes (TC-CUS-00001 …)
-- ---------------------------------------------------------------------
create sequence if not exists customer_code_seq  start 1;
create sequence if not exists service_code_seq   start 1;
create sequence if not exists equipment_code_seq start 1;

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code         text not null unique
                 default ('TC-CUS-' || lpad(nextval('customer_code_seq')::text, 5, '0')),
  name         text not null check (length(btrim(name)) >= 2),
  phone        text not null check (length(regexp_replace(phone, '\D', '', 'g')) between 10 and 13),
  alt_phone    text,
  email        text check (email is null or email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  address      text,
  city         text,
  pincode      text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  notes        text,
  date_added   date not null default current_date,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A phone number may only be used once per business account.
  unique (owner_id, phone)
);

create index if not exists customers_owner_idx on public.customers (owner_id);
create index if not exists customers_name_idx  on public.customers (lower(name));
create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists customers_code_idx  on public.customers (code);

-- ---------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id       uuid not null references public.customers (id) on delete cascade,
  code              text not null unique
                      default ('TC-SRV-' || lpad(nextval('service_code_seq')::text, 5, '0')),

  service_date      date not null,
  service_type      text not null,
  status            text not null default 'Received'
                      check (status in ('Received','Diagnosis','In Progress','Waiting for Parts',
                                        'Ready','Delivered','Completed','Cancelled')),

  -- device
  product           text,
  brand             text,
  model             text,
  serial_number     text,

  -- work
  complaint         text not null,
  diagnosis         text,
  work_performed    text,
  technician        text,

  -- money (all amounts in the business currency, 2 decimal places)
  service_charge    numeric(12,2) not null default 0 check (service_charge >= 0),
  parts_cost        numeric(12,2) not null default 0 check (parts_cost     >= 0),
  discount          numeric(12,2) not null default 0 check (discount       >= 0),
  tax_percent       numeric(5,2)  not null default 0 check (tax_percent    >= 0),
  total_amount      numeric(12,2) not null default 0 check (total_amount   >= 0),
  amount_paid       numeric(12,2) not null default 0 check (amount_paid    >= 0),
  balance           numeric(12,2) not null default 0,
  payment_status    text not null default 'Pending'
                      check (payment_status in ('Paid','Partially Paid','Pending')),
  payment_method    text check (payment_method in ('Cash','UPI','Bank Transfer','Card','Other')),

  -- warranty & follow-up
  warranty_period   text,
  warranty_expiry   date,
  next_service_date date,

  notes             text,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint discount_within_gross check (discount <= service_charge + parts_cost)
);

create index if not exists services_owner_idx    on public.services (owner_id);
create index if not exists services_customer_idx on public.services (customer_id);
create index if not exists services_date_idx     on public.services (service_date desc);
create index if not exists services_status_idx   on public.services (status);
create index if not exists services_payment_idx  on public.services (payment_status);
create index if not exists services_next_idx     on public.services (next_service_date);
create index if not exists services_warranty_idx on public.services (warranty_expiry);
create index if not exists services_code_idx     on public.services (code);

-- ---------------------------------------------------------------------
-- service_parts  (itemised parts replaced during a service)
-- ---------------------------------------------------------------------
create table if not exists public.service_parts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  name        text not null,
  quantity    numeric(10,2) not null default 1 check (quantity > 0),
  unit_price  numeric(12,2) not null default 0 check (unit_price >= 0),
  total       numeric(12,2) not null default 0 check (total >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists service_parts_service_idx on public.service_parts (service_id);

-- ---------------------------------------------------------------------
-- payments  (one row per transaction — supports partial payments)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service_id  uuid not null references public.services  (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  date        date not null default current_date,
  amount      numeric(12,2) not null check (amount > 0),
  method      text not null default 'Cash'
                check (method in ('Cash','UPI','Bank Transfer','Card','Other')),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists payments_service_idx  on public.payments (service_id);
create index if not exists payments_customer_idx on public.payments (customer_id);
create index if not exists payments_date_idx     on public.payments (date desc);

-- ---------------------------------------------------------------------
-- equipment  (devices installed / supplied to a customer)
-- ---------------------------------------------------------------------
create table if not exists public.equipment (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id       uuid not null references public.customers (id) on delete cascade,
  code              text not null unique
                      default ('TC-EQP-' || lpad(nextval('equipment_code_seq')::text, 5, '0')),
  product_type      text not null,
  brand             text,
  model             text,
  serial_number     text,
  installation_date date,
  warranty_period   text,
  warranty_expiry   date,
  location          text,
  status            text not null default 'Active'
                      check (status in ('Active','Under Repair','Replaced','Removed')),
  notes             text,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists equipment_customer_idx on public.equipment (customer_id);
create index if not exists equipment_warranty_idx on public.equipment (warranty_expiry);

-- ---------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_id  uuid references public.services (id) on delete cascade,
  type        text not null default 'Custom'
                check (type in ('Next Service','Warranty','Payment','Custom')),
  title       text not null,
  due_date    date not null,
  done        boolean not null default false,
  notes       text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists reminders_due_idx      on public.reminders (due_date);
create index if not exists reminders_customer_idx on public.reminders (customer_id);
create index if not exists reminders_open_idx     on public.reminders (done, due_date);

-- ---------------------------------------------------------------------
-- business_settings  (one row per account)
-- ---------------------------------------------------------------------
create table if not exists public.business_settings (
  owner_id                uuid primary key default auth.uid()
                            references auth.users (id) on delete cascade,
  name                    text not null default 'TECH CITY TECHNOLOGY',
  tagline                 text not null default 'Computer Sales • Service • CCTV • Networking',
  address                 text,
  phone                   text,
  alt_phone               text,
  email                   text,
  website                 text,
  gst_number              text,
  gst_enabled             boolean not null default false,
  default_tax_percent     numeric(5,2) not null default 0,
  logo_data_url           text,
  terms                   text,
  footer_text             text default 'Thank you for choosing TECH CITY TECHNOLOGY',
  default_warranty_period text default '3 Months',
  default_technician      text,
  service_types           text[] not null default array[
                            'Computer Repair','Laptop Repair','Desktop Service','OS Installation',
                            'Software Installation','Virus/Malware Removal','Data Recovery',
                            'CCTV Installation','CCTV Maintenance','Camera Replacement',
                            'DVR Service','NVR Service','Hard Disk Replacement','Networking',
                            'Printer Service','Other'],
  currency                text not null default '₹',
  invoice_prefix          text not null default 'TC-INV-',
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Automatic totals: total = (service + parts - discount) + tax
--                   balance = total - amount_paid
-- ---------------------------------------------------------------------
create or replace function public.recalculate_service_totals()
returns trigger
language plpgsql
as $$
declare
  subtotal numeric(12,2);
begin
  subtotal          := greatest(0, new.service_charge + new.parts_cost - new.discount);
  new.total_amount  := round(subtotal + (subtotal * coalesce(new.tax_percent, 0) / 100), 2);
  new.balance       := round(new.total_amount - new.amount_paid, 2);
  new.payment_status := case
    when new.total_amount <= 0                      then 'Paid'
    when new.amount_paid  <= 0                      then 'Pending'
    when new.amount_paid  >= new.total_amount       then 'Paid'
    else 'Partially Paid'
  end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists services_totals on public.services;
create trigger services_totals
  before insert or update on public.services
  for each row execute function public.recalculate_service_totals();

-- Keep the parent service's amount_paid in step with the payments table.
create or replace function public.sync_service_amount_paid()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.service_id, old.service_id);
begin
  update public.services s
     set amount_paid = coalesce(
           (select sum(p.amount) from public.payments p where p.service_id = target), 0)
   where s.id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists payments_sync on public.payments;
create trigger payments_sync
  after insert or update or delete on public.payments
  for each row execute function public.sync_service_amount_paid();

-- Generic updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['customers','service_parts','equipment','reminders'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- =====================================================================
--  ROW LEVEL SECURITY
--  Every table is private to the authenticated account that owns the row.
-- =====================================================================
alter table public.customers         enable row level security;
alter table public.services          enable row level security;
alter table public.service_parts     enable row level security;
alter table public.payments          enable row level security;
alter table public.equipment         enable row level security;
alter table public.reminders         enable row level security;
alter table public.business_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['customers','services','service_parts','payments','equipment','reminders'] loop
    execute format('drop policy if exists "%s_owner_all" on public.%I', t, t);
    execute format($f$
      create policy "%s_owner_all" on public.%I
        for all
        to authenticated
        using      (owner_id = auth.uid())
        with check  (owner_id = auth.uid())
    $f$, t, t);
  end loop;
end $$;

drop policy if exists "settings_owner_all" on public.business_settings;
create policy "settings_owner_all" on public.business_settings
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- =====================================================================
--  Handy reporting views
-- =====================================================================
create or replace view public.customer_summary as
select
  c.id,
  c.owner_id,
  c.code,
  c.name,
  c.phone,
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

create or replace view public.upcoming_reminders as
select r.*, c.name as customer_name, c.phone as customer_phone
from public.reminders r
join public.customers c on c.id = r.customer_id
where r.done = false
order by r.due_date;

-- =====================================================================
--  v3 additions (contacts table + customer/service columns)
-- =====================================================================

create table if not exists public.customer_contacts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id   uuid not null references public.customers (id) on delete cascade,
  position      integer not null default 0,
  name          text not null,
  phone         text not null,
  role          text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists customer_contacts_customer_idx on public.customer_contacts (customer_id);
create index if not exists customer_contacts_position_idx on public.customer_contacts (customer_id, position);

-- Add new columns to customers (idempotent)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='customers' and column_name='gst_number') then
    alter table public.customers add column gst_number text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='customers' and column_name='password') then
    alter table public.customers add column password text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='services' and column_name='service_mode') then
    alter table public.services add column service_mode text not null default 'Offline'
      check (service_mode in ('Offline','Online'));
  end if;
end $$;

-- RLS for contacts
alter table public.customer_contacts enable row level security;

drop policy if exists "customer_contacts_owner_all" on public.customer_contacts;
create policy "customer_contacts_owner_all" on public.customer_contacts
  for all to authenticated
  using      (owner_id = auth.uid())
  with check  (owner_id = auth.uid());

-- Extend the reporting view
create or replace view public.customer_summary as
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

-- =====================================================================
--  CLOUD SYNC ADDENDUM (schema v4/v5)
--  Columns + tables the sync layer (src/services/sync.ts) needs. Run this
--  file in full on a fresh project: Supabase Dashboard → SQL Editor → paste.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Column backfills (safe on existing projects)
-- ---------------------------------------------------------------------
alter table public.customers         add column if not exists gst_number      text;
alter table public.customers         add column if not exists password        text;
alter table public.customers         add column if not exists complaint_date  date;
alter table public.customers         add column if not exists amc_type        text;
alter table public.customers         add column if not exists amc_years       integer;
alter table public.customers         add column if not exists amc_start_date  date;
alter table public.customers         add column if not exists amc_expiry      date;

alter table public.services          add column if not exists service_mode    text default 'Offline';
alter table public.service_parts     add column if not exists position        integer;
alter table public.service_parts     add column if not exists cost_price      numeric(12,2);
alter table public.business_settings add column if not exists alt_phone       text;

-- ---------------------------------------------------------------------
-- calls (call book)
-- ---------------------------------------------------------------------
create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date            date not null default current_date,
  source          text not null check (source in ('Online', 'Direct', 'Demo')),
  status          text not null default 'Pending'
                    check (status in ('Pending', 'In Progress', 'Completed', 'No Response')),
  customer_id     uuid references public.customers (id) on delete set null,
  name            text not null,
  phone           text,
  contact_person  text,
  issue           text,
  priority        text check (priority in ('P1', 'P2', 'P3')),
  appointment_date date,
  notes           text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists calls_owner_date_idx on public.calls (owner_id, date desc);
create index if not exists calls_customer_idx   on public.calls (customer_id);

-- ---------------------------------------------------------------------
-- quotations
-- ---------------------------------------------------------------------
create sequence if not exists quotation_code_seq start 1;

create table if not exists public.quotations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code         text not null unique
                 default ('TC-QTN-' || lpad(nextval('quotation_code_seq')::text, 5, '0')),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  date         date not null default current_date,
  valid_until  date,
  status       text not null default 'Draft'
                 check (status in ('Draft', 'Sent', 'Accepted', 'Expired')),
  items        jsonb not null default '[]'::jsonb,
  discount     numeric(12,2) not null default 0,
  tax_percent  numeric(5,2)  not null default 0,
  subtotal     numeric(12,2) not null default 0,
  tax_amount   numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes        text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists quotations_owner_date_idx on public.quotations (owner_id, date desc);
create index if not exists quotations_customer_idx   on public.quotations (customer_id);

-- ---------------------------------------------------------------------
-- counters — keeps human-readable code sequences (TC-CUS-00001 …) in sync
-- so the phone and the computer never reuse a number.
-- ---------------------------------------------------------------------
create table if not exists public.counters (
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null,
  value      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);

-- ---------------------------------------------------------------------
-- Row level security for the new tables
-- ---------------------------------------------------------------------
alter table public.calls          enable row level security;
alter table public.quotations     enable row level security;
alter table public.counters       enable row level security;

drop policy if exists "calls_owner_all" on public.calls;
create policy "calls_owner_all" on public.calls
  for all to authenticated
  using     (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "quotations_owner_all" on public.quotations;
create policy "quotations_owner_all" on public.quotations
  for all to authenticated
  using     (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "counters_owner_all" on public.counters;
create policy "counters_owner_all" on public.counters
  for all to authenticated
  using     (owner_id = auth.uid())
  with check (owner_id = auth.uid());
