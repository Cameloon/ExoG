-- 00034: allow owners to remove files the UI has unlinked or failed to save.
-- Paths stay scoped to the caller; no public delete access is added.

drop policy if exists "Ward images: owner delete" on storage.objects;
create policy "Ward images: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ward-images'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and (
      public.has_role(public.current_clerk_user_id(), 'admin')
      or public.is_approved_sentinel(public.current_clerk_user_id())
      or (auth.jwt() ->> 'app_role') in ('shelter', 'einrichtung')
      or exists (
        select 1 from public.pending_shelter_requests r
        where r.user_id = public.current_clerk_user_id()
          and r.status = 'approved'
      )
    )
  );

drop policy if exists "Lab docs: owner delete" on storage.objects;
create policy "Lab docs: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lab-docs'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and (
      public.has_role(public.current_clerk_user_id(), 'admin')
      or exists (
        select 1 from public.ward_listings w
        where w.id::text = (storage.foldername(name))[2]
          and (
            w.owner_id = public.current_clerk_user_id()
            or public.is_gov_for_region(w.region)
            or exists (
              select 1 from public.shelters s
              where s.id = w.shelter_id
                and s.owner_id = public.current_clerk_user_id()
            )
          )
      )
    )
  );
