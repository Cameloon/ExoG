-- 00026: Shelter-role stability + quarantine simplification.
--
-- 1) pending_shelter_requests has no unique constraint on user_id, so the
--    client upsert (Shelters.tsx requestAccess) acted as a plain INSERT and
--    duplicate rows accumulated. useAuth read the row with .maybeSingle(),
--    which ERRORS on multiple rows → approvedShelter=false → a shelter user
--    was thrown out of the Wards gate ("Sentinel-Pfad") after a refresh.
--    Fix at the data layer: dedupe existing rows, block future duplicates
--    (one approved row per user). The client query is hardened separately.
-- 2) Drop the placement guard: "placed" no longer requires quarantine_safe.
--    Quarantine is a simple on/off + optional lab report; health status
--    lives in the care log.

delete from public.pending_shelter_requests psr
where psr.id in (
  select id from (
    select id,
           row_number() over (partition by user_id order by created_at desc) as rn
    from public.pending_shelter_requests
    where status = 'approved'
  ) ranked
  where ranked.rn > 1
);

create unique index if not exists idx_pending_shelter_one_approved
  on public.pending_shelter_requests(user_id)
  where status = 'approved';

-- Placement guard removal: same policy as 00020/00021 without the
-- (status <> 'placed' or quarantine_status = 'quarantine_safe') check.
drop policy if exists "Wards: staff update" on public.ward_listings;
do $$ begin
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
      or (auth.jwt() ->> 'app_role') in ('behoerde', 'gov', 'shelter', 'einrichtung')
      or exists (
        select 1 from public.pending_shelter_requests r
        where r.user_id = public.current_clerk_user_id()
          and r.status = 'approved'
      )
      or owner_id = public.current_clerk_user_id()
    );
exception when duplicate_object then null;
end $$
