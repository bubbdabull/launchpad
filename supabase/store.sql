-- Store: products + orders. Run in Supabase SQL editor after `collections` exists.
-- Service role (server) bypasses RLS; anon uses read policy on active products only.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  collection_slug text not null,
  name text not null,
  description text not null default '',
  image_url text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  inventory integer not null check (inventory >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_collection_slug_idx on public.products (collection_slug);
create index if not exists products_active_slug_idx on public.products (collection_slug) where active = true;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  collection_slug text not null,
  buyer_email text,
  subtotal_cents integer not null,
  platform_fee_bps integer not null,
  platform_fee_cents integer not null,
  creator_revenue_cents integer not null,
  total_cents integer not null,
  currency text not null default 'USD',
  status text not null default 'pending',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_collection_slug_idx on public.orders (collection_slug);

alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active" on public.products
  for select to anon, authenticated
  using (active = true);

-- orders: no policies — only the Supabase service role (server) reads/writes.
