-- Vigna Digital · Postgres / Supabase schema
-- Run in the Supabase SQL editor, then run seed.sql.
-- Money is stored as integer paise. All writes come from Next.js API routes
-- using the service-role key; RLS is enabled with NO public policies, so the
-- anon key (shipped to browsers) cannot read or write any table.

create extension if not exists "pgcrypto";

create table hotels (
  id                      text primary key,                 -- e.g. 'H101' (used in the QR URL)
  name                    text not null,
  address                 text not null default '',
  phone                   text not null default '',
  gstin                   text not null default '',
  gst_rate                numeric(5,2) not null default 5,
  footer_message          text not null default 'Thank you. Visit again!',
  razorpay_key_id         text,                             -- the owner's own Razorpay account
  razorpay_key_secret_enc text,                             -- AES-256-GCM ciphertext, never plaintext
  created_at              timestamptz not null default now()
);

create table menu_items (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        text not null references hotels(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  category        text not null check (category in ('Starters','Mains','Drinks','Desserts')),
  price_paise     integer not null check (price_paise >= 0),
  is_veg          boolean not null default true,
  spice_level     smallint not null default 0 check (spice_level between 0 and 3),
  image_url       text,
  is_kitchen_item boolean not null default true,            -- false = packaged water, canned soda…
  is_available    boolean not null default true,
  allergens       text[] not null default '{}',
  sort            integer not null default 0
);
create index on menu_items (hotel_id, category, sort);

create table room_stays (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    text not null references hotels(id) on delete cascade,
  room_no     text not null,
  guest_name  text not null,
  phone       text,
  check_in    timestamptz not null,
  check_out   timestamptz not null,
  status      text not null default 'active' check (status in ('active','checked_out'))
);
create index on room_stays (hotel_id, room_no, status);

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  order_no            bigint generated always as identity (start with 1001),
  hotel_id            text not null references hotels(id) on delete cascade,
  customer_name       text not null,
  customer_phone      text not null,
  table_no            text not null,
  room_no             text,
  payment_method      text not null check (payment_method in ('online','room')),
  payment_status      text not null check (payment_status in ('pending_payment','paid','room_pending')),
  status              text not null default 'pending' check (status in ('pending','preparing','ready','served')),
  subtotal_paise      integer not null,
  gst_paise           integer not null,
  total_paise         integer not null,
  razorpay_order_id   text,
  razorpay_payment_id text,
  stay_id             uuid references room_stays(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on orders (hotel_id, created_at desc);
create unique index on orders (razorpay_order_id) where razorpay_order_id is not null;

create table order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  menu_item_id     uuid references menu_items(id) on delete set null,
  name             text not null,                            -- snapshot, survives menu edits
  qty              integer not null check (qty > 0),
  unit_price_paise integer not null,
  is_kitchen_item  boolean not null,                         -- snapshot at order time
  note             text
);
create index on order_items (order_id);

-- Room-charge ledger: PENDING until the front desk settles it at checkout.
create table folio_entries (
  id            uuid primary key default gen_random_uuid(),
  stay_id       uuid not null references room_stays(id) on delete cascade,
  order_id      uuid not null references orders(id) on delete cascade,
  description   text not null,
  amount_paise  integer not null,
  status        text not null default 'pending' check (status in ('pending','settled')),
  created_at    timestamptz not null default now()
);

-- Waiter requests raised by the AI chatbot ("extra napkins to Table 4").
create table service_requests (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    text not null references hotels(id) on delete cascade,
  table_no    text not null,
  message     text not null,
  status      text not null default 'open' check (status in ('open','done')),
  created_at  timestamptz not null default now()
);

alter table hotels           enable row level security;
alter table menu_items       enable row level security;
alter table room_stays       enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table folio_entries    enable row level security;
alter table service_requests enable row level security;
-- (no policies on purpose: service role bypasses RLS, anon gets nothing)
