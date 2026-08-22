-- 00028: Policy fixes for two defects found in audit.
--
-- 1) "Apps: behoerde select region" (00025) checked auth.jwt() ->> 'n' — the
--    Clerk JWT carries the role in 'app_role'. The policy never matched, so
--    behörde users saw zero sentinel applications: empty network map
--    (BehoerdeNetwork) and empty assign-sentinel dropdown (Behoerde).
--
-- 2) "Wards: staff update" (00026) reverted to the pre-00022 shape and lost
--    the region scoping for behörde and the shelter-ownership scoping for
--    einrichtung — any staff role could update ANY ward, including setting
--    owner_id to themselves. Restore the hardened 00024 scoping; the
--    quarantine-guard removal from 00026 stays (deliberate, see 00026 header).
--
-- Safe to re-run (drop if exists + create).

-- 1) Behörde read sentinel_applications in their region.
drop policy if exists "Apps: behoerde select region" on public.sentinel_applications;
create policy "Apps: behoerde select region"
  on public.sentinel_applications for select
  to authenticated
  using (
    (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
    and exists (
      select 1
      from public.profiles p
      where p.id = public.current_clerk_user_id()
        and p.region is not null
        -- containment either way: "München, Bayern" vs. "Bayern"
        and (
          p.region = sentinel_applications.region
          or p.region like '%' || sentinel_applications.region || '%'
          or sentinel_applications.region like '%' || p.region || '%'
        )
    )
  );

-- 2) Ward updates scoped again: admin, owner, behörde in-region, or the
--    shelter that owns the ward. Assignment targets must be the current user
--    or an approved sentinel (keeps the behörde → sentinel assignment flow).
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
    or owner_id = public.current_clerk_user_id()
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
  );
