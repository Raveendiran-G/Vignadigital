-- Run this in Supabase SQL Editor before deploying the order changes.
-- It creates the table if it does not exist, then adds the new fields safely.
-- Back up your database before running migrations on a production project.

create table if not exists public.restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid null references public.restaurants(id) on delete set null,
  restaurant_slug text not null,
  order_number text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  delivery_address text,
  notes text,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.restaurant_orders
  add column if not exists order_type text not null default 'Takeaway',
  add column if not exists table_number text,
  add column if not exists room_number text,
  add column if not exists delivery_city text,
  add column if not exists delivery_pincode text,
  add column if not exists subtotal_amount numeric(12,2),
  add column if not exists tax_amount numeric(12,2),
  add column if not exists tax_rate numeric(5,4) not null default 0.05;

-- Backfill existing orders, if any. New orders receive exact values from the server.
update public.restaurant_orders
set subtotal_amount = coalesce(subtotal_amount, round(total_amount / 1.05, 2)),
    tax_amount = coalesce(tax_amount, total_amount - round(total_amount / 1.05, 2))
where subtotal_amount is null or tax_amount is null;

create index if not exists restaurant_orders_created_at_idx
  on public.restaurant_orders (created_at desc);
create index if not exists restaurant_orders_slug_idx
  on public.restaurant_orders (restaurant_slug, created_at desc);
