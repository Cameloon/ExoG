-- Security/logic hardening for live app workflows.
-- Keeps old migrations replayable while tightening applied projects.

-- DB-side hashing for append-only care logs.
create extension if not exists pgcrypto;

create index if not exists idx_apps_status_created on public.sentinel_applications(status, created_at desc);
create index if not exists idx_apps_region_status_created on public.sentinel_applications(region, status, created_at desc);
create unique index if not exists idx_apps_one_active_per_user
  on public.sentinel_applications(user_id)
  where status <> 'rejected';
create index if not exists idx_ward_region_created on public.ward_listings(region, created_at desc);
create index if not exists idx_pending_shelter_status_created on public.pending_shelter_requests(status, created_at desc);
create index if not exists idx_change_log_changed_at on public.change_log(changed_at desc);

-- Region is an administrative scope. Users may keep editing display fields,
-- but may not self-assign the Behörde region used by RLS.
revoke update on public.profiles from authenticated;
grant update (email, display_name, preferred_language) on public.profiles to authenticated;

create or replace function public.current_region()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'region', ''),
    (select p.region from public.profiles p where p.id = public.current_clerk_user_id())
  )
$$;

create or replace function public.is_gov_for_region(_region text)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.has_role(public.current_clerk_user_id(), 'admin')
      or (
        (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
        and _region is not null
        and _region = public.current_region()
      )
$$;

-- Application document rows must point to the caller's own application and
-- the storage path must stay inside that application folder.
drop policy if exists "Docs: own insert" on public.application_documents;
create policy "Docs: own insert"
  on public.application_documents for insert
  to authenticated
  with check (
    user_id = public.current_clerk_user_id()
    and exists (
      select 1 from public.sentinel_applications a
      where a.id = application_id
        and a.user_id = public.current_clerk_user_id()
    )
    and storage_path like public.current_clerk_user_id() || '/' || application_id::text || '/%'
  );

-- Region-aware ward insert/update. Admin keeps global override; Behörde is
-- confined to its assigned region; shelter users are confined to their own
-- shelter/owner rows.
drop policy if exists "Wards: staff insert" on public.ward_listings;
create policy "Wards: staff insert"
  on public.ward_listings for insert
  to authenticated
  with check (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
      and region = public.current_region()
      and (owner_id = public.current_clerk_user_id() or public.is_approved_sentinel(owner_id))
    )
    or (
      (
        (auth.jwt() ->> 'app_role') in ('shelter', 'einrichtung')
        or exists (
          select 1 from public.pending_shelter_requests r
          where r.user_id = public.current_clerk_user_id()
            and r.status = 'approved'
        )
      )
      and (owner_id = public.current_clerk_user_id() or public.is_approved_sentinel(owner_id))
      and (
        shelter_id is null
        or exists (
          select 1 from public.shelters s
          where s.id = shelter_id
            and s.owner_id = public.current_clerk_user_id()
        )
      )
    )
  );

drop policy if exists "Wards: staff update" on public.ward_listings;
create policy "Wards: staff update"
  on public.ward_listings for update
  to authenticated
  using (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or owner_id = public.current_clerk_user_id()
    or (
      (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
      and region = public.current_region()
    )
    or exists (
      select 1 from public.shelters s
      where s.id = ward_listings.shelter_id
        and s.owner_id = public.current_clerk_user_id()
    )
  )
  with check (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      (status <> 'placed' or quarantine_status = 'quarantine_safe')
      and (
        owner_id = public.current_clerk_user_id()
        or (
          (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
          and region = public.current_region()
          and (owner_id = public.current_clerk_user_id() or public.is_approved_sentinel(owner_id))
        )
        or (
          exists (
            select 1 from public.shelters s
            where s.id = ward_listings.shelter_id
              and s.owner_id = public.current_clerk_user_id()
          )
          and (owner_id = public.current_clerk_user_id() or public.is_approved_sentinel(owner_id))
        )
      )
    )
  );

-- Region-aware care-log reads for authorities.
drop policy if exists "CareLogs: behoerde select" on public.care_logs;
create policy "CareLogs: behoerde select"
  on public.care_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.ward_listings w
      where w.id = ward_id
        and public.is_gov_for_region(w.region)
    )
  );

-- DB-side care-log append: serializes per ward and hashes the stored payload
-- server-side. Direct authenticated INSERT is removed below.
create or replace function public.append_care_log(
  p_ward_id uuid,
  p_author_name text,
  p_type text,
  p_note text,
  p_rationale text,
  p_metrics jsonb default '{}'::jsonb
)
returns table (
  ward_id uuid,
  author_name text,
  type text,
  note text,
  rationale text,
  metrics jsonb,
  hash text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := public.current_clerk_user_id();
  v_prev_hash text;
  v_created_at timestamptz := now();
  v_hash text;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if p_type not in ('Fütterung', 'Medizin', 'Beobachtung', 'Klima', 'Reinigung') then
    raise exception 'invalid care-log type' using errcode = '22023';
  end if;

  if not (
    public.has_role(v_user, 'admin')
    or exists (
      select 1 from public.ward_listings w
      where w.id = p_ward_id and w.owner_id = v_user
    )
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_ward_id::text));

  select c.hash
    into v_prev_hash
  from public.care_logs c
  where c.ward_id = p_ward_id
  order by c.created_at desc, c.id desc
  limit 1;

  v_hash := 'H-' || upper(substr(encode(digest(
    concat_ws('|', p_ward_id::text, p_type, p_note, p_rationale, p_author_name, v_created_at::text, coalesce(v_prev_hash, '')),
    'sha256'
  ), 'hex'), 1, 32));

  return query
    insert into public.care_logs (
      ward_id, author_id, author_name, type, note, rationale, metrics, prev_hash, hash, created_at
    )
    values (
      p_ward_id, v_user, p_author_name, p_type, p_note, coalesce(p_rationale, ''),
      coalesce(p_metrics, '{}'::jsonb), v_prev_hash, v_hash, v_created_at
    )
    returning
      care_logs.ward_id,
      care_logs.author_name,
      care_logs.type,
      care_logs.note,
      care_logs.rationale,
      care_logs.metrics,
      care_logs.hash,
      care_logs.created_at;
end;
$$;

revoke insert on public.care_logs from authenticated;
grant execute on function public.append_care_log(uuid, text, text, text, text, jsonb) to authenticated;

-- Identification requests are authority-scoped. Existing null-region rows
-- remain visible to authorities for backward compatibility; new rows must
-- carry the current authority region.
alter table public.identification_requests add column if not exists region text;
create index if not exists idx_id_req_region_status on public.identification_requests(region, status, created_at desc);

drop policy if exists "IDReq: gov insert" on public.identification_requests;
create policy "IDReq: gov insert"
  on public.identification_requests for insert
  to authenticated
  with check (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
      and region = public.current_region()
    )
  );

drop policy if exists "IDReq: gov+expert select" on public.identification_requests;
create policy "IDReq: gov+expert select"
  on public.identification_requests for select
  to authenticated
  using (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or public.is_expert(public.current_clerk_user_id())
    or (
      (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
      and (region = public.current_region() or region is null)
    )
  );

drop policy if exists "IDReq: gov update" on public.identification_requests;
create policy "IDReq: gov update"
  on public.identification_requests for update
  to authenticated
  using (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
      and (region = public.current_region() or region is null)
    )
  )
  with check (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
      and region = public.current_region()
    )
  );

-- Transport logs: authorities are scoped to ward region.
drop policy if exists "Transport: owner+gov insert" on public.transport_logs;
create policy "Transport: owner+gov insert"
  on public.transport_logs for insert
  to authenticated
  with check (
    handler_id = public.current_clerk_user_id()
    and exists (
      select 1 from public.ward_listings w
      where w.id = ward_id
        and (
          w.owner_id = public.current_clerk_user_id()
          or public.is_gov_for_region(w.region)
        )
    )
  );

drop policy if exists "Transport: owner+gov select" on public.transport_logs;
create policy "Transport: owner+gov select"
  on public.transport_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.ward_listings w
      where w.id = ward_id
        and (
          w.owner_id = public.current_clerk_user_id()
          or public.is_gov_for_region(w.region)
        )
    )
  );

-- Lab reports: no global vetted-sentinel reads. Read by ward owner, scoped
-- authority, or admin only.
drop policy if exists "Lab docs: gov insert" on storage.objects;
create policy "Lab docs: gov insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lab-docs'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and exists (
      select 1 from public.ward_listings w
      where w.id::text = (storage.foldername(name))[2]
        and public.is_gov_for_region(w.region)
    )
  );

drop policy if exists "Lab docs: owner read" on storage.objects;
create policy "Lab docs: ward owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'lab-docs'
    and exists (
      select 1 from public.ward_listings w
      where w.id::text = (storage.foldername(name))[2]
        and w.owner_id = public.current_clerk_user_id()
    )
  );

drop policy if exists "Lab docs: gov read" on storage.objects;
create policy "Lab docs: gov read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'lab-docs'
    and exists (
      select 1 from public.ward_listings w
      where w.id::text = (storage.foldername(name))[2]
        and public.is_gov_for_region(w.region)
    )
  );

drop policy if exists "Lab docs: vetted read" on storage.objects;
