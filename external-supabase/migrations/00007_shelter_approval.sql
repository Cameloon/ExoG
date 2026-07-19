-- Pending shelter (Einrichtung) confirmation requests.
-- Self-service signup picks "shelter"; an admin must confirm before the
-- Clerk role is granted (no KYC, unlike sentinels). The actual Clerk
-- publicMetadata.role = 'shelter' is set by an admin on approval.

do $$ begin
  create type public.shelter_approval_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.pending_shelter_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  email text not null,
  display_name text,
  status public.shelter_approval_status not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pending_shelter_requests enable row level security;

drop policy if exists "ShelterReq: admin all" on public.pending_shelter_requests;
create policy "ShelterReq: admin all"
  on public.pending_shelter_requests for all
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "ShelterReq: user own" on public.pending_shelter_requests;
create policy "ShelterReq: user own"
  on public.pending_shelter_requests for all
  to authenticated
  using (user_id = public.current_clerk_user_id())
  with check (user_id = public.current_clerk_user_id());

create index if not exists idx_pending_shelter_user on public.pending_shelter_requests(user_id);
create index if not exists idx_pending_shelter_status on public.pending_shelter_requests(status);

drop trigger if exists pending_shelter_requests_updated_at on public.pending_shelter_requests;
create trigger pending_shelter_requests_updated_at
before update on public.pending_shelter_requests
for each row execute function public.set_updated_at();
