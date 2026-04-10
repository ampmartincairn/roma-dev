create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique,
  email text unique not null,
  password text not null,
  full_name text,
  role text not null default 'client',
  company_name text,
  is_active boolean not null default false,
  client_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists reception_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null,
  client_email text not null,
  client_name text,
  reception_type text,
  sent_to_work_date text,
  status text not null,
  items jsonb not null default '[]'::jsonb,
  marketplace text,
  warehouse text,
  comment text,
  operator_comment text,
  processed_by text,
  processed_date text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists assembly_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  client_email text not null,
  client_name text,
  status text not null,
  items jsonb not null default '[]'::jsonb,
  marketplace text,
  destination_warehouse text,
  packaging_type text,
  cargo_places numeric,
  comment text,
  operator_comment text,
  processed_by text,
  shipped_date text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  sku text not null,
  client_email text not null,
  warehouse text not null,
  quantity numeric not null default 0,
  reserved numeric not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null,
  barcode text,
  category text,
  client_email text not null,
  client_name text,
  weight_kg numeric,
  dimensions text,
  image_url text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists action_logs (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  user_name text,
  action text not null,
  entity_type text,
  entity_id text,
  details text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists idx_reception_requests_client_email on reception_requests(client_email);
create index if not exists idx_assembly_orders_client_email on assembly_orders(client_email);
create index if not exists idx_inventory_client_email_sku on inventory(client_email, sku);
create index if not exists idx_products_client_email on products(client_email);
create index if not exists idx_action_logs_created_date on action_logs(created_date desc);

alter table users enable row level security;
alter table reception_requests enable row level security;
alter table assembly_orders enable row level security;
alter table inventory enable row level security;
alter table products enable row level security;
alter table action_logs enable row level security;

-- Demo policies for quick start (replace with strict policies in production)
drop policy if exists "Allow all users" on users;
create policy "Allow all users" on users for all using (true) with check (true);

drop policy if exists "Allow all reception_requests" on reception_requests;
create policy "Allow all reception_requests" on reception_requests for all using (true) with check (true);

drop policy if exists "Allow all assembly_orders" on assembly_orders;
create policy "Allow all assembly_orders" on assembly_orders for all using (true) with check (true);

drop policy if exists "Allow all inventory" on inventory;
create policy "Allow all inventory" on inventory for all using (true) with check (true);

drop policy if exists "Allow all products" on products;
create policy "Allow all products" on products for all using (true) with check (true);

drop policy if exists "Allow all action_logs" on action_logs;
create policy "Allow all action_logs" on action_logs for all using (true) with check (true);

insert into users (username, email, password, full_name, role, company_name, is_active)
values ('admin', 'admin@local.dev', 'admin123', 'Administrator', 'admin', 'Local WMS', true)
on conflict (email) do nothing;
