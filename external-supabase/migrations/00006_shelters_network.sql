-- Shelters (Einrichtungen) + Sentinel↔Shelter volunteer network
-- Clerk-backed: user identifiers are text values from auth.jwt() ->> 'sub'.
-- Behörde (gov) responsibility is by region (matches ward_listings.region).

do $$ begin
  create type public.user_kind as enum ('sentinel', 'shelter', 'gov');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shelter_request_status as enum ('open', 'accepted', 'declined', 'withdrawn');
exception when duplicate_object then null; end $$;

create table if not exists public.shelters (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null,
  kind public.user_kind not null default 'shelter',
  region text not null,
  address text,
  lat double precision,
  lng double precision,
  contact_email text,
  contact_phone text,
  description text,
  capacity_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shelters enable row level security;

drop policy if exists "Shelters: admin all" on public.shelters;
create policy "Shelters: admin all"
  on public.shelters for all
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "Shelters: owner all" on public.shelters;
create policy "Shelters: owner all"
  on public.shelters for all
  to authenticated
  using (owner_id = public.current_clerk_user_id())
  with check (owner_id = public.current_clerk_user_id());

drop policy if exists "Shelters: vetted read" on public.shelters;
create policy "Shelters: vetted read"
  on public.shelters for select
  to authenticated
  using (public.is_approved_sentinel(public.current_clerk_user_id()));

-- Wards listed by a shelter are owned by the shelter owner, but we tag them
-- with shelter_id so the Einrichtung view can filter its own animals.
alter table public.ward_listings add column if not exists shelter_id uuid references public.shelters(id) on delete set null;

create index if not exists idx_ward_listings_shelter on public.ward_listings(shelter_id);
create index if not exists idx_ward_listings_region on public.ward_listings(region);
create index if not exists idx_shelters_region on public.shelters(region);

-- Sentinel volunteers for a shelter (explicit request from sentinel).
create table if not exists public.sentinel_shelter_requests (
  id uuid primary key default gen_random_uuid(),
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  sentinel_id text not null,
  message text,
  status public.shelter_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shelter_id, sentinel_id)
);

alter table public.sentinel_shelter_requests enable row level security;

drop policy if exists "ShelterReq: admin all" on public.sentinel_shelter_requests;
create policy "ShelterReq: admin all"
  on public.sentinel_shelter_requests for all
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "ShelterReq: shelter owner all" on public.sentinel_shelter_requests;
create policy "ShelterReq: shelter owner all"
  on public.sentinel_shelter_requests for all
  to authenticated
  using (exists (
    select 1 from public.shelters s
    where s.id = shelter_id and s.owner_id = public.current_clerk_user_id()
  ))
  with check (exists (
    select 1 from public.shelters s
    where s.id = shelter_id and s.owner_id = public.current_clerk_user_id()
  ));

drop policy if exists "ShelterReq: sentinel own" on public.sentinel_shelter_requests;
create policy "ShelterReq: sentinel own"
  on public.sentinel_shelter_requests for all
  to authenticated
  using (sentinel_id = public.current_clerk_user_id())
  with check (
    sentinel_id = public.current_clerk_user_id()
    and public.is_approved_sentinel(public.current_clerk_user_id())
  );

drop trigger if exists shelters_updated_at on public.shelters;
create trigger shelters_updated_at
before update on public.shelters
for each row execute function public.set_updated_at();

drop trigger if exists sentinel_shelter_requests_updated_at on public.sentinel_shelter_requests;
create trigger sentinel_shelter_requests_updated_at
before update on public.sentinel_shelter_requests
for each row execute function public.set_updated_at();

create index if not exists idx_shelter_requests_shelter on public.sentinel_shelter_requests(shelter_id);
create index if not exists idx_shelter_requests_sentinel on public.sentinel_shelter_requests(sentinel_id);
