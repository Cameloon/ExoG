-- Security/logic fixes from the full-repo audit (2026-08).
-- Applies on top of 00021 + 00022; all statements are idempotent.

-- ── 1. Ward shelter-owner access: FOR ALL -> SELECT only ───────
-- 00009 granted shelter owners full CRUD on every ward of their shelter,
-- including DELETE (cascades through care_logs/transport_logs evidence)
-- and UPDATE without the quarantine gate. Replace with a SELECT policy;
-- updates stay gated by "Wards: staff update" (00022), which already
-- covers shelter owners with the quarantine check.
drop policy if exists "Wards: shelter owner all" on public.ward_listings;
create policy "Wards: shelter owner select"
  on public.ward_listings for select
  to authenticated
  using (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or owner_id = public.current_clerk_user_id()
    or exists (
      select 1 from public.shelters s
      where s.id = ward_listings.shelter_id
        and s.owner_id = public.current_clerk_user_id()
    )
  );

-- ── 2. Authorities need SELECT on ward_listings in their region ─
-- 00022 scoped the gov reads of care_logs/transport_logs/lab-docs via
-- subqueries against ward_listings, but there was no gov SELECT policy on
-- ward_listings itself, so every such read returned zero rows (broken
-- closed). This unblocks the Behörde workflow.
drop policy if exists "Wards: gov select" on public.ward_listings;
create policy "Wards: gov select"
  on public.ward_listings for select
  to authenticated
  using (
    (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
    and region = public.current_region()
  );

-- ── 3. Storage: file-type whitelists + region-scoped reads ──────
-- Client-side sniffing is bypassable via direct API calls; the storage
-- policies now enforce the same extension allowlist as ward-images (00013).

drop policy if exists "Lab docs: owner insert" on storage.objects;
create policy "Lab docs: owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lab-docs'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'pdf')
    and exists (
      select 1 from public.ward_listings w
      where w.id::text = (storage.foldername(name))[2]
        and w.owner_id = public.current_clerk_user_id()
    )
  );

drop policy if exists "Lab docs: gov insert" on storage.objects;
create policy "Lab docs: gov insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lab-docs'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'pdf')
    and public.is_gov(public.current_clerk_user_id())
  );

drop policy if exists "Lab docs: gov read" on storage.objects;
create policy "Lab docs: gov read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'lab-docs'
    and (
      public.has_role(public.current_clerk_user_id(), 'admin')
      or exists (
        select 1 from public.ward_listings w
        where w.id::text = (storage.foldername(name))[2]
          and public.is_gov_for_region(w.region)
      )
    )
  );

drop policy if exists "ID photos: gov insert" on storage.objects;
create policy "ID photos: gov insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'id-photos'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'pdf')
    and public.is_gov(public.current_clerk_user_id())
  );

drop policy if exists "ID photos: gov+expert read" on storage.objects;
create policy "ID photos: gov+expert read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'id-photos'
    and (
      public.has_role(public.current_clerk_user_id(), 'admin')
      or public.is_expert(public.current_clerk_user_id())
      or exists (
        select 1 from public.identification_requests r
        where r.id::text = (storage.foldername(name))[2]
          and (r.region = public.current_region() or r.region is null)
      )
    )
  );

-- ── 4. IDReq update must keep working for legacy null-region rows ─
-- USING allows them (00022), but WITH CHECK `region = current_region()`
-- evaluates to NULL for null-region rows, silently blocking every update.
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
      and (region is null or region = public.current_region())
    )
  );

-- ── 5. Votes read scoped to the request's region ────────────────
drop policy if exists "Votes: gov+expert select" on public.identification_votes;
create policy "Votes: gov+expert select"
  on public.identification_votes for select
  to authenticated
  using (
    public.has_role(public.current_clerk_user_id(), 'admin')
    or public.is_expert(public.current_clerk_user_id())
    or (
      (auth.jwt() ->> 'app_role') in ('behoerde', 'gov')
      and exists (
        select 1 from public.identification_requests r
        where r.id = request_id
          and (r.region = public.current_region() or r.region is null)
      )
    )
  );

-- ── 6. Functions: no PUBLIC execute (anon oracle) ───────────────
-- security definer helpers default to PUBLIC execute; combined with the
-- anon schema grants, unauthenticated callers could probe role/status of
-- known user ids. authenticated-only now.
revoke execute on function public.has_role(text, text) from public;
revoke execute on function public.is_approved_sentinel(text) from public;
revoke execute on function public.is_expert(text) from public;
revoke execute on function public.is_gov(text) from public;
revoke execute on function public.is_gov_for_region(text) from public;
revoke execute on function public.current_region() from public;
revoke execute on function public.current_clerk_user_id() from public;
revoke execute on function public.append_care_log(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.has_role(text, text) to authenticated;
grant execute on function public.is_approved_sentinel(text) to authenticated;
grant execute on function public.is_expert(text) to authenticated;
grant execute on function public.is_gov(text) to authenticated;
grant execute on function public.is_gov_for_region(text) to authenticated;
grant execute on function public.current_region() to authenticated;
grant execute on function public.current_clerk_user_id() to authenticated;

-- ── 7. Drop the duplicate change_log index (00018 + 00022) ─────
drop index if exists public.idx_change_log_time;

-- ── 8. Grants the Behörde flow needs for the new policy shape ──
grant select on public.ward_listings to authenticated;
