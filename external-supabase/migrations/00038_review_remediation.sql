-- Apply after 00037. Explicit triage discovery, protected workflow commands,
-- transactional deletion, and durable notification state. Safe to re-run.
begin;

revoke insert on public.sentinel_applications from authenticated;
update public.sentinel_applications set tier='S1' where status in ('pending','under_review');
drop policy if exists "Apps: own insert" on public.sentinel_applications;
drop policy if exists "Apps: shelter select applicants" on public.sentinel_applications;
drop policy if exists "Apps: behoerde select region" on public.sentinel_applications;

-- Profiles are client-created, but jurisdiction is assigned by administrators.
drop policy if exists "Profiles: own insert" on public.profiles;
create policy "Profiles: own insert" on public.profiles for insert to authenticated
  with check (id = public.current_clerk_user_id() and region is null);

create or replace function public.can_browse_sentinels()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_clerk_user_id() is not null and (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (auth.jwt() ->> 'app_role') in ('behoerde', 'gov', 'einrichtung', 'shelter')
    or exists (select 1 from public.pending_shelter_requests r
      where r.user_id = public.current_clerk_user_id() and r.status = 'approved')
  )
$$;
revoke all on function public.can_browse_sentinels() from public, anon;
grant execute on function public.can_browse_sentinels() to authenticated;

-- An allowlist projection: all approved sentinels nationwide, regardless of
-- application/request relationships. KYC, DOB and reviewer notes stay private.
create or replace function public.list_sentinels(
  p_after text default null, p_limit integer default 100,
  p_search text default '', p_user_ids text[] default null
)
returns table (user_id text, case_id text, full_name text, email text, region text,
  experience_years integer, species_focus text, capacity text, motivation text,
  tier text, status text, created_at timestamptz, pledge_data jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.can_browse_sentinels(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select a.user_id, a.case_id, a.full_name, a.email, a.region,
      a.experience_years, a.species_focus, a.capacity, a.motivation,
      a.tier, a.status::text, a.created_at,
      jsonb_build_object(
        'quarantine', a.pledge_data->'quarantine',
        'vet_contact', a.pledge_data->'vet_contact',
        'questionnaire', jsonb_build_object(
          'street', a.pledge_data#>'{questionnaire,street}',
          'house_number', a.pledge_data#>'{questionnaire,house_number}',
          'zip', a.pledge_data#>'{questionnaire,zip}',
          'city', a.pledge_data#>'{questionnaire,city}',
          'phone', a.pledge_data#>'{questionnaire,phone}',
          'enclosure', a.pledge_data#>'{questionnaire,enclosure}',
          'enclosures', coalesce(nullif(p.enclosures, '[]'::jsonb), a.pledge_data#>'{questionnaire,enclosures}', '[]'::jsonb),
          'current_stock', a.pledge_data#>'{questionnaire,current_stock}',
          'feeding', a.pledge_data#>'{questionnaire,feeding}',
          'overwintering', a.pledge_data#>'{questionnaire,overwintering}',
          'sachkunde', a.pledge_data#>'{questionnaire,sachkunde}',
          'sachkunde_detail', a.pledge_data#>'{questionnaire,sachkunde_detail}'
        ))
    from public.sentinel_applications a left join public.profiles p on p.id = a.user_id
    where a.status = 'approved'
      and (p_after is null or a.user_id > p_after)
      and (p_user_ids is null or a.user_id = any(p_user_ids))
      and (coalesce(p_search, '') = '' or strpos(lower(concat_ws(' ', a.full_name,
        a.region, a.species_focus, a.tier, a.pledge_data#>>'{questionnaire,city}')),
        lower(left(p_search, 200))) > 0)
    order by a.user_id limit greatest(1, least(coalesce(p_limit,100), 200));
end $$;
revoke all on function public.list_sentinels(text, integer, text, text[]) from public, anon;
grant execute on function public.list_sentinels(text, integer, text, text[]) to authenticated;

create or replace function public.sentinel_region_counts()
returns table(region text, total bigint) language plpgsql stable security definer set search_path=public as $$
begin
  if not coalesce(public.can_browse_sentinels(),false) then raise exception 'forbidden' using errcode='42501'; end if;
  return query select a.region, count(*) from public.sentinel_applications a where a.status='approved' group by a.region;
end $$;
revoke all on function public.sentinel_region_counts() from public, anon;
grant execute on function public.sentinel_region_counts() to authenticated;

-- Owners may review a real request, but cannot create one for another person.
drop policy if exists "ShelterReq: shelter owner all" on public.sentinel_shelter_requests;
drop policy if exists "ShelterReq: shelter owner select" on public.sentinel_shelter_requests;
create policy "ShelterReq: shelter owner select" on public.sentinel_shelter_requests
  for select to authenticated using (exists (select 1 from public.shelters s
    where s.id = shelter_id and s.owner_id = public.current_clerk_user_id()));
drop policy if exists "ShelterReq: shelter owner update" on public.sentinel_shelter_requests;
create policy "ShelterReq: shelter owner update" on public.sentinel_shelter_requests
  for update to authenticated using (exists (select 1 from public.shelters s
    where s.id = shelter_id and s.owner_id = public.current_clerk_user_id()));
drop policy if exists "ShelterReq: shelter owner delete" on public.sentinel_shelter_requests;
create policy "ShelterReq: shelter owner delete" on public.sentinel_shelter_requests
  for delete to authenticated using (exists (select 1 from public.shelters s
    where s.id = shelter_id and s.owner_id = public.current_clerk_user_id()));

-- RLS chooses accessible rows; the trigger protects identities, columns and
-- transitions. Existing withdraw, declined-request reopen and hide actions work.
create or replace function public.guard_request_write()
returns trigger language plpgsql set search_path = public as $$
declare
  v_user text := public.current_clerk_user_id();
  v_own boolean;
begin
  if current_user in ('postgres', 'service_role') or coalesce(public.has_role(v_user, 'admin'), false) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status::text <> 'open' then raise exception 'request must start open' using errcode='42501'; end if;
    return new;
  end if;
  if tg_table_name = 'sentinel_shelter_requests' then
    if new.id <> old.id or new.shelter_id <> old.shelter_id or new.sentinel_id <> old.sentinel_id then
      raise exception 'request identities are immutable' using errcode='42501';
    end if;
    v_own := old.sentinel_id = v_user;
  else
    if new.id <> old.id or new.ward_id <> old.ward_id or new.applicant_id <> old.applicant_id then
      raise exception 'request identities are immutable' using errcode='42501';
    end if;
    v_own := old.applicant_id = v_user;
  end if;
  if v_own then
    if (to_jsonb(new) - array['status','message','updated_at','sentinel_hidden','consultation_requested'])
      is distinct from (to_jsonb(old) - array['status','message','updated_at','sentinel_hidden','consultation_requested']) then
      raise exception 'protected request fields' using errcode='42501';
    end if;
    if new.status is distinct from old.status and not (
      new.status::text = 'withdrawn' or
      (old.status::text in ('declined','withdrawn') and new.status::text = 'open')
    ) then raise exception 'decision belongs to recipient' using errcode='42501'; end if;
  else
    if (to_jsonb(new) - array['status','updated_at']) is distinct from (to_jsonb(old) - array['status','updated_at']) then
      raise exception 'recipient may only change status' using errcode='42501';
    end if;
    if old.status::text = 'withdrawn' and new.status is distinct from old.status then
      raise exception 'withdrawn request cannot be decided' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_request_write() from public, anon, authenticated;
drop trigger if exists guard_request_write on public.sentinel_shelter_requests;
create trigger guard_request_write before insert or update on public.sentinel_shelter_requests
  for each row execute function public.guard_request_write();
drop trigger if exists guard_request_write on public.ward_interest;
create trigger guard_request_write before insert or update on public.ward_interest
  for each row execute function public.guard_request_write();

drop policy if exists "ChangeReq: owner all" on public.sentinel_change_requests;
drop policy if exists "ChangeReq: own read" on public.sentinel_change_requests;
create policy "ChangeReq: own read" on public.sentinel_change_requests for select to authenticated
  using (user_id = public.current_clerk_user_id());
drop policy if exists "ChangeReq: own submit" on public.sentinel_change_requests;
create policy "ChangeReq: own submit" on public.sentinel_change_requests for insert to authenticated
  with check (user_id = public.current_clerk_user_id() and status = 'pending'
    and reviewed_by is null and reviewed_at is null and reviewer_notes is null);
drop policy if exists "ChangeReq: own cancel pending" on public.sentinel_change_requests;
create policy "ChangeReq: own cancel pending" on public.sentinel_change_requests for delete to authenticated
  using (user_id = public.current_clerk_user_id() and status = 'pending');

create or replace function public.review_sentinel_change(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.sentinel_change_requests; a_id uuid;
begin
  if not coalesce(public.has_role(public.current_clerk_user_id(), 'admin'),false) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into r from public.sentinel_change_requests where id=p_id for update;
  if not found or r.status <> 'pending' then raise exception 'request is not pending'; end if;
  if p_approve then
    if coalesce(r.requested->>'zip','') !~ '^\d{5}$'
      or coalesce(length(trim(r.requested->>'street')),0) not between 1 and 160
      or coalesce(length(trim(r.requested->>'house_number')),0) not between 1 and 20
      or coalesce(length(trim(r.requested->>'city')),0) not between 1 and 120 then
      raise exception 'invalid address';
    end if;
    select id into a_id from public.sentinel_applications where user_id=r.user_id
      and status <> 'rejected' order by created_at desc limit 1 for update;
    if not found then raise exception 'active application not found'; end if;
    update public.sentinel_applications set pledge_data = jsonb_set(pledge_data, '{questionnaire}',
      coalesce(pledge_data->'questionnaire','{}'::jsonb) || jsonb_build_object(
        'street',r.requested->>'street','house_number',r.requested->>'house_number',
        'zip',r.requested->>'zip','city',r.requested->>'city')) where id=a_id;
  end if;
  update public.sentinel_change_requests set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=public.current_clerk_user_id(), reviewed_at=now(), updated_at=now() where id=p_id;
end $$;
revoke all on function public.review_sentinel_change(uuid,boolean) from public, anon;
grant execute on function public.review_sentinel_change(uuid,boolean) to authenticated;

alter table public.application_audit_log alter column application_id drop not null;
create table if not exists public.account_deletion_jobs (
  user_id text primary key,
  stage text not null check (stage in ('database_deleted','storage_deleted','complete')),
  updated_at timestamptz not null default now()
);
alter table public.account_deletion_jobs enable row level security;
revoke all on public.account_deletion_jobs from public, anon, authenticated;
grant select, update on public.account_deletion_jobs to service_role;

-- One transaction: no storage is destroyed until every DB operation succeeds.
-- Only the verified-identity edge function can call this command.
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

alter table public.sentinel_applications add column if not exists confirmation_status text
  not null default 'staging' check (confirmation_status in ('staging','pending','sent'));
alter table public.sentinel_applications add column if not exists confirmation_next_attempt_at timestamptz not null default now();
-- Existing applications predate the queue; do not resend historical mail.
-- Only run this backfill on the first installation of the queue marker.
do $$ begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_application_confirmation_pending') then
    update public.sentinel_applications set confirmation_status='sent';
    create index idx_application_confirmation_pending on public.sentinel_applications(created_at)
      where confirmation_status='pending';
  end if;
end $$;
create index if not exists idx_confirmation_due on public.sentinel_applications(confirmation_next_attempt_at)
  where confirmation_status='pending';

commit;
