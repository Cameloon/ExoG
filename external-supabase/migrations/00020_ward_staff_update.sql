-- Allow staff to update ward_listings (reassign owner to sentinel).
-- The old "Wards: owner update" policy blocked changing owner_id to
-- another user because its `with check` required owner_id = current user.
drop policy if exists "Wards: owner update" on public.ward_listings;
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
end $$;
