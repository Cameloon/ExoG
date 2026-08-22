-- Care & Identification features
-- 1. ward_listings: Pflegestellen-Modus (placement_type, legal_custody) + Quarantäne
-- 2. Sentinel tier S1–S4 (on the application) — S4 sentinels are the
--    Bestimmungshilfe experts. No separate role:
--      update public.sentinel_applications set tier = 'S4' where user_id = 'user_...';
-- 3. identification_requests / identification_votes: Bestimmungshilfe
-- 4. transport_logs: Transportplan documentation (evidence chain)
-- 5. Storage buckets lab-docs / id-photos

-- ── Enums ─────────────────────────────────────────────────────

do $$ begin
  create type public.placement_type as enum ('endstelle', 'pflegestelle');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quarantine_status as enum ('unknown', 'in_quarantine', 'quarantine_safe', 'suspected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.id_request_status as enum ('open', 'confirmed', 'closed');
exception when duplicate_object then null; end $$;

-- ── Sentinel tier (S1 = Grundstufe … S4 = höchste Stufe) ──────

alter table public.sentinel_applications
  add column if not exists tier text not null default 'S1'
    check (tier in ('S1', 'S2', 'S3', 'S4'));

-- ── Helpers ───────────────────────────────────────────────────

-- Gov = Behörde (Clerk app_role) or admin. Same JWT-claim pattern as 00014.
create or replace function public.is_gov(_user_id text)
returns boolean
language sql
stable
set search_path = public
as $$
  select (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
      or public.has_role(_user_id, 'admin')
$$;

-- Expert = approved sentinel with tier S4 (voting in the Bestimmungshilfe).
create or replace function public.is_expert(_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sentinel_applications
    where user_id = _user_id
      and status = 'approved'
      and tier = 'S4'
  )
$$;

-- ── ward_listings columns ─────────────────────────────────────

alter table public.ward_listings
  add column if not exists placement_type public.placement_type not null default 'endstelle',
  add column if not exists legal_custody boolean not null default false,
  add column if not exists quarantine_status public.quarantine_status not null default 'unknown',
  add column if not exists quarantine_until timestamptz,
  add column if not exists lab_report_path text;

create index if not exists idx_ward_listings_placement on public.ward_listings(placement_type, quarantine_status);

-- Placement guard: a ward can only become "placed" once quarantine_safe.
-- Applied to the staff-update policy from 00020 (owner, behoerde, shelter,
-- einrichtung paths). Admin keeps a bypass. WITH CHECK sees the NEW row, so
-- this blocks exactly the status->placed transition for non-safe wards.
drop policy if exists "Wards: owner update" on public.ward_listings;
drop policy if exists "Wards: staff update" on public.ward_listings;
create policy "Wards: staff update"
  on public.ward_listings for update
  to authenticated
  using (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (auth.jwt() ->> 'app_role') in ('behoerde', 'gov', 'shelter', 'einrichtung')
    or exists (
      select 1 from public.pending_shelter_requests r
      where r.user_id = public.current_clerk_user_id()
        and r.status = 'approved'
    )
    or owner_id = public.current_clerk_user_id()
  )
  with check (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      (status <> 'placed' or quarantine_status = 'quarantine_safe')
      and (
        (auth.jwt() ->> 'app_role') in ('behoerde', 'gov', 'shelter', 'einrichtung')
        or exists (
          select 1 from public.pending_shelter_requests r
          where r.user_id = public.current_clerk_user_id()
            and r.status = 'approved'
        )
        or owner_id = public.current_clerk_user_id()
      )
    )
  );

-- ── identification_requests ───────────────────────────────────

create table if not exists public.identification_requests (
  id                uuid primary key default gen_random_uuid(),
  created_by        text not null,
  common_name       text not null,
  description       text not null default '',
  photos            text[] not null default '{}',
  status            public.id_request_status not null default 'open',
  confirmed_species text,
  confirmed_listing text,
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_id_req_status on public.identification_requests(status);

alter table public.identification_requests enable row level security;

drop policy if exists "IDReq: gov insert" on public.identification_requests;
create policy "IDReq: gov insert"
  on public.identification_requests for insert
  to authenticated
  with check (public.is_gov(public.current_clerk_user_id()));

drop policy if exists "IDReq: gov+expert select" on public.identification_requests;
create policy "IDReq: gov+expert select"
  on public.identification_requests for select
  to authenticated
  using (
    public.is_gov(public.current_clerk_user_id())
    or public.is_expert(public.current_clerk_user_id())
  );

drop policy if exists "IDReq: gov update" on public.identification_requests;
create policy "IDReq: gov update"
  on public.identification_requests for update
  to authenticated
  using (public.is_gov(public.current_clerk_user_id()))
  with check (public.is_gov(public.current_clerk_user_id()));

drop trigger if exists id_req_updated_at on public.identification_requests;
create trigger id_req_updated_at
before update on public.identification_requests
for each row execute function public.set_updated_at();

-- ── identification_votes (append-only) ────────────────────────

create table if not exists public.identification_votes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.identification_requests(id) on delete cascade,
  expert_id  text not null,
  species    text not null,
  listing    text,
  confidence text not null check (confidence in ('hoch', 'mittel', 'niedrig')),
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (request_id, expert_id)
);

create index if not exists idx_id_votes_req on public.identification_votes(request_id);

alter table public.identification_votes enable row level security;

drop policy if exists "Votes: expert insert" on public.identification_votes;
create policy "Votes: expert insert"
  on public.identification_votes for insert
  to authenticated
  with check (
    expert_id = public.current_clerk_user_id()
    and public.is_expert(public.current_clerk_user_id())
  );

drop policy if exists "Votes: gov+expert select" on public.identification_votes;
create policy "Votes: gov+expert select"
  on public.identification_votes for select
  to authenticated
  using (
    public.is_gov(public.current_clerk_user_id())
    or public.is_expert(public.current_clerk_user_id())
  );

-- ── transport_logs (append-only, evidence chain) ──────────────

create table if not exists public.transport_logs (
  id            uuid primary key default gen_random_uuid(),
  ward_id       uuid not null references public.ward_listings(id) on delete cascade,
  handler_id    text not null,
  from_location text not null default '',
  to_location   text not null default '',
  mode          text not null default '',
  carrier       text not null default '',
  checklist     text[] not null default '{}',
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists idx_transport_ward on public.transport_logs(ward_id, created_at desc);

alter table public.transport_logs enable row level security;

drop policy if exists "Transport: owner+gov insert" on public.transport_logs;
create policy "Transport: owner+gov insert"
  on public.transport_logs for insert
  to authenticated
  with check (
    handler_id = public.current_clerk_user_id()
    and (
      public.is_gov(public.current_clerk_user_id())
      or exists (
        select 1 from public.ward_listings w
        where w.id = ward_id and w.owner_id = public.current_clerk_user_id()
      )
    )
  );

drop policy if exists "Transport: owner+gov select" on public.transport_logs;
create policy "Transport: owner+gov select"
  on public.transport_logs for select
  to authenticated
  using (
    public.is_gov(public.current_clerk_user_id())
    or exists (
      select 1 from public.ward_listings w
      where w.id = ward_id and w.owner_id = public.current_clerk_user_id()
    )
  );

-- ── Storage: lab-docs ─────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('lab-docs', 'lab-docs', false)
on conflict (id) do nothing;

-- Path scheme: {ownerId}/{wardId}/{file}. Storage policies can join to
-- ward_listings via the ward id folder segment, so only the ward owner
-- (or gov/admin) can attach lab documents to a ward.
drop policy if exists "Lab docs: owner insert" on storage.objects;
create policy "Lab docs: owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lab-docs'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and exists (
      select 1 from public.ward_listings w
      where w.id::text = (storage.foldername(name))[2]
        and w.owner_id = public.current_clerk_user_id()
    )
  );

drop policy if exists "Lab docs: gov insert" on storage.objects;
create policy "Lab docs: gov insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lab-docs'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and public.is_gov(public.current_clerk_user_id())
  );

drop policy if exists "Lab docs: owner read" on storage.objects;
create policy "Lab docs: owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'lab-docs'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
  );

drop policy if exists "Lab docs: gov read" on storage.objects;
create policy "Lab docs: gov read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'lab-docs'
    and public.is_gov(public.current_clerk_user_id())
  );

drop policy if exists "Lab docs: vetted read" on storage.objects;
create policy "Lab docs: vetted read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'lab-docs'
    and public.is_approved_sentinel(public.current_clerk_user_id())
  );

-- ── Storage: id-photos (Bestimmungshilfe) ─────────────────────

insert into storage.buckets (id, name, public)
values ('id-photos', 'id-photos', false)
on conflict (id) do nothing;

-- Path scheme: {creatorId}/{requestId or uuid}/{file}.
drop policy if exists "ID photos: gov insert" on storage.objects;
create policy "ID photos: gov insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'id-photos'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and public.is_gov(public.current_clerk_user_id())
  );

drop policy if exists "ID photos: gov+expert read" on storage.objects;
create policy "ID photos: gov+expert read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'id-photos'
    and (
      public.is_gov(public.current_clerk_user_id())
      or public.is_expert(public.current_clerk_user_id())
    )
  );

-- ── Grants ────────────────────────────────────────────────────

grant select, insert, update on public.identification_requests to authenticated;
grant select, insert on public.identification_votes to authenticated;
grant select, insert on public.transport_logs to authenticated;
