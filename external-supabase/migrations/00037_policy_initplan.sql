-- 00037: Advisor fixes — RLS initplan + lint cleanups.
--
-- 1) Auth RLS Initialization Plan (advisor 0016-ish): policies that call
--    auth.jwt() directly re-evaluate it for EVERY ROW. Wrapping in a scalar
--    subselect — (select auth.jwt() ->> 'app_role') — turns it into an
--    InitPlan: evaluated once per statement. Same semantics, same results.
--    Applied to every policy with a direct auth.jwt() call:
--      ward_listings:            staff insert / staff update / gov select
--      sentinel_applications:    behoerde select region
--      identification_requests:  gov insert / gov+expert select / gov update
--      identification_votes:    gov+expert select
--      shelters:                 owner all
-- 2) current_clerk_user_id(): the one non-security-definer helper — it is
--    INLINED into ~40 policies, so its bare auth.jwt() became a per-row call
--    in each of them. Wrapping the body makes every inlined use an InitPlan.
--    (has_role()/current_region() are SECURITY DEFINER → never inlined → a
--    wrap inside them changes nothing; left as-is on purpose.)
-- 3) Duplicate Index: idx_pending_shelter_status (status) is a left prefix of
--    idx_pending_shelter_status_created (status, created_at desc) — drop it.
-- 4) Extension in Public: pg_trgm moves to the extensions schema (default
--    Supabase search_path includes it; the trigram index resolves by OID, so
--    the SpeciesInput autocomplete is unaffected). 00003's
--    `create extension if not exists` still replays cleanly afterwards.
-- 5) SECURITY DEFINER functions executable by PUBLIC/authenticated but never
--    called directly: log_change() and rls_auto_enable() are trigger/event-
--    trigger functions — trigger execution does not check EXECUTE privileges,
--    so the grants serve no one.
--
-- Idempotent: drop-if-exists + create per policy; everything else guarded.

-- ── 1) Policies: auth.jwt() → (select auth.jwt()) ────────────────────────

drop policy if exists "Wards: staff insert" on public.ward_listings;
create policy "Wards: staff insert"
  on public.ward_listings for insert
  to authenticated
  with check (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
      and region = public.current_region()
      and (owner_id = public.current_clerk_user_id() or public.is_approved_sentinel(owner_id))
    )
    or (
      (
        ((select auth.jwt() ->> 'app_role')) in ('shelter', 'einrichtung')
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
      ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
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
    or owner_id = public.current_clerk_user_id()
    or (
      ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
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
  );

drop policy if exists "Wards: gov select" on public.ward_listings;
create policy "Wards: gov select"
  on public.ward_listings for select
  to authenticated
  using (
    ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
    and region = public.current_region()
  );

drop policy if exists "Apps: behoerde select region" on public.sentinel_applications;
create policy "Apps: behoerde select region"
  on public.sentinel_applications for select
  to authenticated
  using (
    ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
    and public.current_region() is not null
    and (
      sentinel_applications.region = public.current_region()
      or sentinel_applications.region like '%' || public.current_region() || '%'
      or public.current_region() like '%' || sentinel_applications.region || '%'
    )
  );

drop policy if exists "IDReq: gov insert" on public.identification_requests;
create policy "IDReq: gov insert"
  on public.identification_requests for insert
  to authenticated
  with check (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
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
      ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
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
      ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
      and (region = public.current_region() or region is null)
    )
  )
  with check (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or (
      ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
      and (region is null or region = public.current_region())
    )
  );

drop policy if exists "Votes: gov+expert select" on public.identification_votes;
create policy "Votes: gov+expert select"
  on public.identification_votes for select
  to authenticated
  using (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or public.is_expert(public.current_clerk_user_id())
    or (
      ((select auth.jwt() ->> 'app_role')) in ('behoerde', 'gov')
      and exists (
        select 1 from public.identification_requests r
        where r.id = request_id
          and (r.region = public.current_region() or r.region is null)
      )
    )
  );

drop policy if exists "Shelters: owner all" on public.shelters;
create policy "Shelters: owner all"
  on public.shelters for all
  to authenticated
  using (owner_id = public.current_clerk_user_id())
  with check (
    owner_id = public.current_clerk_user_id()
    and (
      public.has_role(public.current_clerk_user_id(), 'admin')
      or ((select auth.jwt() ->> 'app_role')) in ('shelter', 'einrichtung', 'behoerde', 'gov')
      or exists (
        select 1 from public.pending_shelter_requests r
        where r.user_id = public.current_clerk_user_id()
          and r.status = 'approved'
      )
    )
  );

-- ── 2) current_clerk_user_id(): inlined into ~40 policies ───────────────
-- (select …) inside the body survives inlining as a scalar subquery → InitPlan.
create or replace function public.current_clerk_user_id()
returns text
language sql
stable
set search_path = public
as $$
  select (select auth.jwt() ->> 'sub')
$$;

-- ── 3) Duplicate index: prefix of idx_pending_shelter_status_created ────
drop index if exists public.idx_pending_shelter_status;

-- ── 4) pg_trgm → extensions schema (advisor: extension in public) ───────
do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'public'
  ) then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end
$$;

-- ── 5) Trigger/event-trigger functions need no caller grants ───────────
revoke execute on function public.log_change() from public, authenticated;
revoke execute on function public.rls_auto_enable() from public, authenticated;
