-- ExoFusion Core Schema (Clerk-backed)
-- All user identifiers are text from auth.jwt() ->> 'sub'.
-- Run this BEFORE 00002 and 00003.

-- ── Helper functions ──────────────────────────────────────────

create or replace function public.current_clerk_user_id()
returns text
language sql
stable
set search_path = public
as $$
  select auth.jwt() ->> 'sub'
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Enums ─────────────────────────────────────────────────────

do $$ begin
  create type public.app_role as enum ('admin', 'moderator', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_status as enum ('pending', 'under_review', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kyc_status as enum ('not_started', 'documents_uploaded', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

-- ── Tables ────────────────────────────────────────────────────
-- Drop and recreate with text user IDs (Clerk-compatible).

drop table if exists public.application_audit_log cascade;
drop table if exists public.application_documents cascade;
drop table if exists public.sentinel_applications cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id                text primary key,
  email             text,
  display_name      text,
  preferred_language text default 'de',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.sentinel_applications (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,
  case_id            text not null unique,
  full_name          text not null,
  email              text not null,
  region             text not null,
  experience_years   int not null,
  species_focus      text,
  capacity           text not null,
  motivation         text not null,
  pledge_data        jsonb not null default '{}'::jsonb,
  status             public.application_status not null default 'pending',
  kyc_status         public.kyc_status not null default 'not_started',
  reviewer_notes     text,
  reviewed_by        text,
  reviewed_at        timestamptz,
  preferred_language text default 'de',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.application_documents (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.sentinel_applications(id) on delete cascade,
  user_id          text not null,
  doc_type         text not null,
  storage_path     text not null,
  file_name        text not null,
  mime_type        text,
  size_bytes       int,
  created_at       timestamptz not null default now()
);

create table public.application_audit_log (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.sentinel_applications(id) on delete cascade,
  actor_id         text,
  action           text not null,
  from_status      public.application_status,
  to_status        public.application_status,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ── Functions (after tables, so type resolution works) ───────

create or replace function public.has_role(_user_id text, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role::text = _role
  )
$$;

-- ── Triggers ──────────────────────────────────────────────────

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger applications_updated before update on public.sentinel_applications
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.sentinel_applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.application_audit_log enable row level security;

-- Profiles policies
drop policy if exists "Profiles: own select" on public.profiles;
create policy "Profiles: own select"
  on public.profiles for select to authenticated
  using (id = public.current_clerk_user_id());

drop policy if exists "Profiles: admin select" on public.profiles;
create policy "Profiles: admin select"
  on public.profiles for select to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "Profiles: own update" on public.profiles;
create policy "Profiles: own update"
  on public.profiles for update to authenticated
  using (id = public.current_clerk_user_id());

-- User roles policies
drop policy if exists "Roles: own select" on public.user_roles;
create policy "Roles: own select"
  on public.user_roles for select to authenticated
  using (user_id = public.current_clerk_user_id());

drop policy if exists "Roles: admin select" on public.user_roles;
create policy "Roles: admin select"
  on public.user_roles for select to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "Roles: admin manage" on public.user_roles;
create policy "Roles: admin manage"
  on public.user_roles for all to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

-- Sentinel applications policies
drop policy if exists "Apps: own insert" on public.sentinel_applications;
create policy "Apps: own insert"
  on public.sentinel_applications for insert to authenticated
  with check (user_id = public.current_clerk_user_id());

drop policy if exists "Apps: own select" on public.sentinel_applications;
create policy "Apps: own select"
  on public.sentinel_applications for select to authenticated
  using (user_id = public.current_clerk_user_id());

drop policy if exists "Apps: admin select" on public.sentinel_applications;
create policy "Apps: admin select"
  on public.sentinel_applications for select to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "Apps: admin update" on public.sentinel_applications;
create policy "Apps: admin update"
  on public.sentinel_applications for update to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

-- Application documents policies
drop policy if exists "Docs: own insert" on public.application_documents;
create policy "Docs: own insert"
  on public.application_documents for insert to authenticated
  with check (user_id = public.current_clerk_user_id());

drop policy if exists "Docs: own select" on public.application_documents;
create policy "Docs: own select"
  on public.application_documents for select to authenticated
  using (user_id = public.current_clerk_user_id());

drop policy if exists "Docs: admin select" on public.application_documents;
create policy "Docs: admin select"
  on public.application_documents for select to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'));

-- Application audit log policies
drop policy if exists "Audit: admin select" on public.application_audit_log;
create policy "Audit: admin select"
  on public.application_audit_log for select to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "Audit: admin insert" on public.application_audit_log;
create policy "Audit: admin insert"
  on public.application_audit_log for insert to authenticated
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

-- ── Storage: KYC Documents ────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

drop policy if exists "KYC: own upload" on storage.objects;
create policy "KYC: own upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
  );

drop policy if exists "KYC: own read" on storage.objects;
create policy "KYC: own read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
  );

drop policy if exists "KYC: admin read" on storage.objects;
create policy "KYC: admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and public.has_role(public.current_clerk_user_id(), 'admin')
  );
