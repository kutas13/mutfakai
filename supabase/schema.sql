-- MutfakAI v2: Supabase SQL Editor'da çalıştır
create extension if not exists "pgcrypto";

------------------------------------------------------------
-- 1) profiles — kullanıcı profili, premium durumu
------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  is_premium boolean not null default false,
  lang text not null default 'tr' check (lang in ('tr', 'en')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles: select own" on public.profiles;
create policy "Profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Profiles: insert own" on public.profiles;
create policy "Profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Admin tüm profilleri görebilsin ve güncelleyebilsin
drop policy if exists "Profiles: admin select all" on public.profiles;
create policy "Profiles: admin select all"
  on public.profiles for select
  using (auth.jwt() ->> 'email' = 'gmyusuf13@gmail.com');

drop policy if exists "Profiles: admin update all" on public.profiles;
create policy "Profiles: admin update all"
  on public.profiles for update
  using (auth.jwt() ->> 'email' = 'gmyusuf13@gmail.com');

-- Yeni kullanıcı kaydında otomatik profil oluştur
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

------------------------------------------------------------
-- 2) stocks — envanter (birim: gr, ml, adet)
------------------------------------------------------------
create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  item_name text not null,
  quantity numeric(14, 3) not null check (quantity >= 0),
  unit text not null check (unit in ('gr', 'ml', 'adet')),
  created_at timestamptz not null default now()
);

create index if not exists stocks_user_id_idx on public.stocks (user_id);
alter table public.stocks enable row level security;

drop policy if exists "Stocks: select own" on public.stocks;
create policy "Stocks: select own" on public.stocks for select using (auth.uid() = user_id);
drop policy if exists "Stocks: insert own" on public.stocks;
create policy "Stocks: insert own" on public.stocks for insert with check (auth.uid() = user_id);
drop policy if exists "Stocks: update own" on public.stocks;
create policy "Stocks: update own" on public.stocks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Stocks: delete own" on public.stocks;
create policy "Stocks: delete own" on public.stocks for delete using (auth.uid() = user_id);

------------------------------------------------------------
-- 3) premium_requests — premium telefon talepleri
------------------------------------------------------------
create table if not exists public.premium_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  phone_number text not null,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'activated', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists premium_requests_user_id_idx on public.premium_requests (user_id);
alter table public.premium_requests enable row level security;

drop policy if exists "PremiumReq: insert own" on public.premium_requests;
create policy "PremiumReq: insert own"
  on public.premium_requests for insert with check (auth.uid() = user_id);

drop policy if exists "PremiumReq: select own" on public.premium_requests;
create policy "PremiumReq: select own"
  on public.premium_requests for select using (auth.uid() = user_id);

drop policy if exists "PremiumReq: admin select all" on public.premium_requests;
create policy "PremiumReq: admin select all"
  on public.premium_requests for select
  using (auth.jwt() ->> 'email' = 'gmyusuf13@gmail.com');

drop policy if exists "PremiumReq: admin update all" on public.premium_requests;
create policy "PremiumReq: admin update all"
  on public.premium_requests for update
  using (auth.jwt() ->> 'email' = 'gmyusuf13@gmail.com');

------------------------------------------------------------
-- 4) admin_audit_logs — owner test ve denetim kayıtları
------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_user_id_idx on public.admin_audit_logs (user_id);
create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);
alter table public.admin_audit_logs enable row level security;

drop policy if exists "Audit: insert own" on public.admin_audit_logs;
create policy "Audit: insert own"
  on public.admin_audit_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Audit: select own" on public.admin_audit_logs;
create policy "Audit: select own"
  on public.admin_audit_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Audit: admin select all" on public.admin_audit_logs;
create policy "Audit: admin select all"
  on public.admin_audit_logs for select
  using (auth.jwt() ->> 'email' = 'gmyusuf13@gmail.com');
