-- Fix Ward access for Einrichtungen (shelters).
-- 1) Grants: ward_listings / ward_interest were created after 00005 and never
--    got table privileges for `authenticated` -> "permission denied" on insert.
-- 2) RLS: only approved sentinels could insert wards; shelters (Einrichtungen)
--    are the ones actually housing animals, so allow shelter owners too.

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on public.ward_listings to authenticated;
grant select on public.ward_listings to anon;

grant select, insert, update, delete on public.ward_interest to authenticated;

-- Shelter owners may fully manage their own ward listings.
drop policy if exists "Wards: shelter owner all" on public.ward_listings;
create policy "Wards: shelter owner all"
  on public.ward_listings for all
  to authenticated
  using (
    exists (
      select 1 from public.shelters s
      where s.id = ward_listings.shelter_id
        and s.owner_id = public.current_clerk_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.shelters s
      where s.id = ward_listings.shelter_id
        and s.owner_id = public.current_clerk_user_id()
    )
  );

-- Shelter owners may read interest on their wards.
drop policy if exists "Interest: shelter owner select" on public.ward_interest;
create policy "Interest: shelter owner select"
  on public.ward_interest for select
  to authenticated
  using (
    exists (
      select 1 from public.ward_listings w
      join public.shelters s on s.id = w.shelter_id
      where w.id = ward_interest.ward_id
        and s.owner_id = public.current_clerk_user_id()
    )
  );
