-- Adoption Marketplace / Wards
-- Clerk-backed schema: user identifiers are text values from auth.jwt() ->> 'sub'.

create or replace function public.is_approved_sentinel(_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sentinel_applications
    where user_id = _user_id
      and status = 'approved'
  )
$$;

do $$ begin
  create type public.ward_status as enum ('available', 'under_review', 'placed', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ward_visibility as enum ('vetted_only', 'admin_only');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ward_interest_status as enum ('open', 'shortlisted', 'declined', 'withdrawn', 'matched');
exception when duplicate_object then null; end $$;

create table if not exists public.ward_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  case_code text not null unique,
  common_name text not null,
  scientific_name text,
  sex text,
  age_estimate text,
  size_estimate text,
  origin_context text,
  background text not null,
  care_requirements text not null,
  space_requirements text not null,
  region text,
  urgency text not null default 'standard',
  status public.ward_status not null default 'available',
  visibility public.ward_visibility not null default 'vetted_only',
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ward_listings enable row level security;

drop policy if exists "Wards: admin all" on public.ward_listings;
create policy "Wards: admin all"
  on public.ward_listings for all
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "Wards: owner select" on public.ward_listings;
create policy "Wards: owner select"
  on public.ward_listings for select
  to authenticated
  using (owner_id = public.current_clerk_user_id());

drop policy if exists "Wards: vetted select" on public.ward_listings;
create policy "Wards: vetted select"
  on public.ward_listings for select
  to authenticated
  using (
    visibility = 'vetted_only'
    and status in ('available', 'under_review')
    and public.is_approved_sentinel(public.current_clerk_user_id())
  );

drop policy if exists "Wards: owner insert" on public.ward_listings;
create policy "Wards: owner insert"
  on public.ward_listings for insert
  to authenticated
  with check (
    owner_id = public.current_clerk_user_id()
    and public.is_approved_sentinel(public.current_clerk_user_id())
  );

drop policy if exists "Wards: owner update" on public.ward_listings;
create policy "Wards: owner update"
  on public.ward_listings for update
  to authenticated
  using (owner_id = public.current_clerk_user_id())
  with check (owner_id = public.current_clerk_user_id());

drop trigger if exists ward_listings_updated_at on public.ward_listings;
create trigger ward_listings_updated_at
before update on public.ward_listings
for each row execute function public.set_updated_at();

create table if not exists public.ward_interest (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references public.ward_listings(id) on delete cascade,
  applicant_id text not null,
  message text not null,
  status public.ward_interest_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ward_id, applicant_id)
);

alter table public.ward_interest enable row level security;

drop policy if exists "Interest: admin all" on public.ward_interest;
create policy "Interest: admin all"
  on public.ward_interest for all
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "Interest: applicant select own" on public.ward_interest;
create policy "Interest: applicant select own"
  on public.ward_interest for select
  to authenticated
  using (applicant_id = public.current_clerk_user_id());

drop policy if exists "Interest: ward owner select" on public.ward_interest;
create policy "Interest: ward owner select"
  on public.ward_interest for select
  to authenticated
  using (exists (
    select 1
    from public.ward_listings w
    where w.id = ward_id
      and w.owner_id = public.current_clerk_user_id()
  ));

drop policy if exists "Interest: applicant insert" on public.ward_interest;
create policy "Interest: applicant insert"
  on public.ward_interest for insert
  to authenticated
  with check (
    applicant_id = public.current_clerk_user_id()
    and public.is_approved_sentinel(public.current_clerk_user_id())
  );

drop policy if exists "Interest: applicant withdraw" on public.ward_interest;
create policy "Interest: applicant withdraw"
  on public.ward_interest for update
  to authenticated
  using (applicant_id = public.current_clerk_user_id())
  with check (
    applicant_id = public.current_clerk_user_id()
    and status in ('open', 'withdrawn')
  );

drop policy if exists "Interest: ward owner update status" on public.ward_interest;
create policy "Interest: ward owner update status"
  on public.ward_interest for update
  to authenticated
  using (exists (
    select 1
    from public.ward_listings w
    where w.id = ward_id
      and w.owner_id = public.current_clerk_user_id()
  ))
  with check (exists (
    select 1
    from public.ward_listings w
    where w.id = ward_id
      and w.owner_id = public.current_clerk_user_id()
  ));

drop trigger if exists ward_interest_updated_at on public.ward_interest;
create trigger ward_interest_updated_at
before update on public.ward_interest
for each row execute function public.set_updated_at();

create index if not exists idx_ward_listings_status on public.ward_listings(status);
create index if not exists idx_ward_interest_ward on public.ward_interest(ward_id);
create index if not exists idx_ward_interest_applicant on public.ward_interest(applicant_id);

insert into storage.buckets (id, name, public)
values ('ward-images', 'ward-images', false)
on conflict (id) do nothing;

drop policy if exists "Ward images: owner upload" on storage.objects;
create policy "Ward images: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ward-images'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and public.is_approved_sentinel(public.current_clerk_user_id())
  );

drop policy if exists "Ward images: owner read" on storage.objects;
create policy "Ward images: owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ward-images'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
  );

drop policy if exists "Ward images: vetted read" on storage.objects;
create policy "Ward images: vetted read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ward-images'
    and public.is_approved_sentinel(public.current_clerk_user_id())
  );

drop policy if exists "Ward images: admin read" on storage.objects;
create policy "Ward images: admin read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ward-images'
    and public.has_role(public.current_clerk_user_id(), 'admin')
  );
