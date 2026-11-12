begin;

create table if not exists public.authority_ward_assignment_requests (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references public.ward_listings(id) on delete cascade,
  authority_id text not null,
  sentinel_id text not null,
  message text,
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'cancelled')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (message is null or length(message) <= 1000)
);

create unique index if not exists authority_ward_assignment_requests_one_open_pair
  on public.authority_ward_assignment_requests(ward_id, sentinel_id)
  where status = 'open';
create index if not exists authority_ward_assignment_requests_sentinel_open
  on public.authority_ward_assignment_requests(sentinel_id, created_at desc)
  where status = 'open';

alter table public.authority_ward_assignment_requests enable row level security;
revoke all on public.authority_ward_assignment_requests from anon, authenticated;
grant select, insert on public.authority_ward_assignment_requests to authenticated;

drop policy if exists "AssignmentReq: parties read" on public.authority_ward_assignment_requests;
create policy "AssignmentReq: parties read"
  on public.authority_ward_assignment_requests for select to authenticated
  using (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or authority_id = public.current_clerk_user_id()
    or sentinel_id = public.current_clerk_user_id()
  );

drop policy if exists "AssignmentReq: authority create" on public.authority_ward_assignment_requests;
create policy "AssignmentReq: authority create"
  on public.authority_ward_assignment_requests for insert to authenticated
  with check (
    authority_id = public.current_clerk_user_id()
    and status = 'open'
    and (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
    and exists (
      select 1 from public.ward_listings w
      where w.id = ward_id
        and w.owner_id = authority_id
        and w.status in ('available', 'under_review')
        and public.is_gov_for_region(w.region)
        and public.is_approved_sentinel(sentinel_id)
    )
  );

drop policy if exists "Wards: requested sentinel select" on public.ward_listings;
create policy "Wards: requested sentinel select"
  on public.ward_listings for select to authenticated
  using (exists (
    select 1 from public.authority_ward_assignment_requests r
    where r.ward_id = ward_listings.id
      and r.sentinel_id = public.current_clerk_user_id()
      and r.status = 'open'
  ));

drop trigger if exists authority_ward_assignment_requests_updated_at on public.authority_ward_assignment_requests;
create trigger authority_ward_assignment_requests_updated_at
  before update on public.authority_ward_assignment_requests
  for each row execute function public.set_updated_at();

create or replace function public.guard_authority_direct_ward_transfer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
    and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if (tg_op = 'INSERT' and new.owner_id is distinct from public.current_clerk_user_id())
      or (tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id) then
      raise exception 'Authorities must request a ward assignment; the sentinel must accept it'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ward_authority_transfer_requires_consent on public.ward_listings;
create trigger ward_authority_transfer_requires_consent
  before insert or update of owner_id on public.ward_listings
  for each row execute function public.guard_authority_direct_ward_transfer();

create or replace function public.respond_authority_ward_assignment_request(p_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.authority_ward_assignment_requests%rowtype;
  w public.ward_listings%rowtype;
  v_user text := public.current_clerk_user_id();
  v_ward_found boolean;
begin
  if v_user is null or p_accept is null then
    raise exception 'invalid request' using errcode = '22023';
  end if;

  select * into r from public.authority_ward_assignment_requests where id = p_id;
  if not found then raise exception 'request not found'; end if;
  if r.sentinel_id <> v_user then raise exception 'forbidden' using errcode = '42501'; end if;

  -- Lock the ward first, matching match_ward_interest's lock order.
  select * into w from public.ward_listings where id = r.ward_id for update;
  v_ward_found := found;
  select * into r from public.authority_ward_assignment_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if r.status <> 'open' then raise exception 'request is no longer open' using errcode = '55000'; end if;

  if not p_accept then
    update public.authority_ward_assignment_requests
      set status = 'declined', responded_at = now() where id = p_id;
    return 'declined';
  end if;

  if not v_ward_found or w.owner_id <> r.authority_id
    or w.status not in ('available', 'under_review')
    or not public.is_approved_sentinel(v_user) then
    update public.authority_ward_assignment_requests
      set status = 'cancelled', responded_at = now() where id = p_id;
    return 'cancelled';
  end if;

  update public.ward_listings
    set owner_id = v_user, status = 'under_review'
    where id = w.id;
  update public.authority_ward_assignment_requests
    set status = 'accepted', responded_at = now() where id = p_id;
  update public.authority_ward_assignment_requests
    set status = 'cancelled', responded_at = now()
    where ward_id = w.id and id <> p_id and status = 'open';
  return 'accepted';
end;
$$;

revoke all on function public.respond_authority_ward_assignment_request(uuid, boolean) from public, anon;
grant execute on function public.respond_authority_ward_assignment_request(uuid, boolean) to authenticated;

-- Keep assignment requests inside the existing transactional account deletion.
create or replace function public.delete_account_data(p_user_id text)
returns text language plpgsql security definer set search_path = public as $$
declare v_stage text;
begin
  if p_user_id is null or length(p_user_id) < 1 or p_user_id = 'deleted' then raise exception 'invalid user'; end if;
  perform pg_advisory_xact_lock(hashtext('delete-account:' || p_user_id));
  select stage into v_stage from public.account_deletion_jobs where user_id=p_user_id;
  if v_stage is not null then return v_stage; end if;
  update public.ward_listings set owner_id='deleted',status='withdrawn',images='{}',lab_report_path=null where owner_id=p_user_id;
  delete from public.application_documents where user_id=p_user_id;
  delete from public.sentinel_applications where user_id=p_user_id;
  delete from public.pending_shelter_requests where user_id=p_user_id;
  delete from public.sentinel_shelter_requests where sentinel_id=p_user_id;
  delete from public.ward_interest where applicant_id=p_user_id;
  delete from public.authority_ward_assignment_requests where authority_id=p_user_id or sentinel_id=p_user_id;
  delete from public.shelters where owner_id=p_user_id;
  delete from public.identification_requests where created_by=p_user_id;
  delete from public.sentinel_change_requests where user_id=p_user_id;
  delete from public.duties where owner_id=p_user_id;
  delete from public.user_roles where user_id=p_user_id;
  delete from public.profiles where id=p_user_id;
  update public.care_logs set author_name='Gelöschtes Konto' where author_id=p_user_id;
  update public.transport_logs set handler_id='deleted' where handler_id=p_user_id;
  update public.change_log set actor_id='deleted' where actor_id=p_user_id;
  update public.role_change_log set actor_id='deleted' where actor_id=p_user_id;
  update public.role_change_log set target_user_id='deleted' where target_user_id=p_user_id;
  update public.application_audit_log set actor_id='deleted' where actor_id=p_user_id;
  insert into public.account_deletion_jobs(user_id,stage) values (p_user_id,'database_deleted');
  return 'database_deleted';
end $$;
revoke all on function public.delete_account_data(text) from public, anon, authenticated;
grant execute on function public.delete_account_data(text) to service_role;

commit;
