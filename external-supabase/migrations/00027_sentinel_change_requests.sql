-- 00027: Sentinel profile-change requests with admin approval loop.
--
-- Sentinels may request an address change; it only becomes effective once an
-- admin approves. This keeps identity/address data on the custody record
-- reviewable instead of self-service (the "full address at signup" rule needs
-- an audit trail for later edits too).

create table public.sentinel_change_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  requested      jsonb not null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  reviewed_by    text,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.sentinel_change_requests enable row level security;

create index if not exists idx_change_req_user on public.sentinel_change_requests(user_id, created_at desc);
create index if not exists idx_change_req_open on public.sentinel_change_requests(status, created_at desc);

grant select, insert, update on public.sentinel_change_requests to authenticated;

-- Owner: see + create their own requests (address change submissions).
drop policy if exists "ChangeReq: owner all" on public.sentinel_change_requests;
create policy "ChangeReq: owner all"
  on public.sentinel_change_requests for all
  to authenticated
  using (user_id = public.current_clerk_user_id())
  with check (user_id = public.current_clerk_user_id());

-- Admin: review queue (select + status flip on approval/rejection).
drop policy if exists "ChangeReq: admin select" on public.sentinel_change_requests;
create policy "ChangeReq: admin select"
  on public.sentinel_change_requests for select
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "ChangeReq: admin update" on public.sentinel_change_requests;
create policy "ChangeReq: admin update"
  on public.sentinel_change_requests for update
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));
