-- 00032: Authorities as map entities + request cancellation.
--
-- 1) Behörden-RLS: "Apps: behoerde select region" required a profiles.region
--    row that nothing writes (admin sets Clerk metadata only). Use
--    current_region() instead, which reads the Clerk JWT region claim with a
--    profiles.region fallback — so approved sentinels become visible for
--    correctly configured authorities.
-- 2) Authorities keep a location profile in `shelters` with kind='gov' so
--    they appear on the network map. The owner-all policy must accept the
--    behoerde/gov app_role.
-- 3) Sentinels can cancel their own pending address-change request
--    (sentinel_change_requests): the owner policy is FOR ALL, but the
--    authenticated role lacked the DELETE grant.

-- 1) Behörde reads sentinels in their region (JWT region, not profiles-only).
drop policy if exists "Apps: behoerde select region" on public.sentinel_applications;
create policy "Apps: behoerde select region"
  on public.sentinel_applications for select
  to authenticated
  using (
    (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
    and public.current_region() is not null
    and (
      sentinel_applications.region = public.current_region()
      or sentinel_applications.region like '%' || public.current_region() || '%'
      or public.current_region() like '%' || sentinel_applications.region || '%'
    )
  );

-- 2) Authorities may create/update their own authority location profile.
drop policy if exists "Shelters: owner all" on public.shelters;
create policy "Shelters: owner all"
  on public.shelters for all
  to authenticated
  using (owner_id = public.current_clerk_user_id())
  with check (
    owner_id = public.current_clerk_user_id()
    and (
      public.has_role(public.current_clerk_user_id(), 'admin')
      or (auth.jwt() ->> 'app_role') in ('shelter', 'einrichtung', 'behoerde', 'gov')
      or exists (
        select 1 from public.pending_shelter_requests r
        where r.user_id = public.current_clerk_user_id()
          and r.status = 'approved'
      )
    )
  );

-- 3) Sentinels can delete their own change requests.
grant delete on public.sentinel_change_requests to authenticated;
