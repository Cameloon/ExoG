-- Security hardening: close self-approval escalation paths found in audit.
-- Idempotent policy replacements; no table/data changes.

-- 1) Sentinel applications: users could insert a row with status='approved'
--    (and kyc_status='verified'), which is_approved_sentinel() then trusted.
--    New applications must enter as unreviewed.
drop policy if exists "Apps: own insert" on public.sentinel_applications;
do $$ begin
  create policy "Apps: own insert"
    on public.sentinel_applications for insert to authenticated
    with check (
      user_id = public.current_clerk_user_id()
      and status = 'pending'
      and kyc_status = 'not_started'
    );
exception when duplicate_object then null;
end $$;

-- 2) KYC storage: clients could upload straight into the bucket, bypassing
--    the kyc-upload edge function's magic-byte validation (stored-XSS vector
--    against admins opening signed URLs). The edge function writes with the
--    service role and does not need this policy.
drop policy if exists "KYC: own upload" on storage.objects;

-- 3) Shelters: "owner all" let any authenticated user insert a shelters row
--    with themselves as owner. Insert now requires admin, the Clerk
--    'shelter' app_role, or an approved pending_shelter_requests row.
drop policy if exists "Shelters: owner all" on public.shelters;
do $$ begin
  create policy "Shelters: owner all"
    on public.shelters for all
    to authenticated
    using (owner_id = public.current_clerk_user_id())
    with check (
      owner_id = public.current_clerk_user_id()
      and (
        public.has_role(public.current_clerk_user_id(), 'admin')
        or (auth.jwt() ->> 'app_role') in ('shelter', 'einrichtung')
        or exists (
          select 1 from public.pending_shelter_requests r
          where r.user_id = public.current_clerk_user_id()
            and r.status = 'approved'
        )
      )
    );
exception when duplicate_object then null;
end $$;

-- 4) Pending shelter requests: "user own ... for all" let users flip their
--    own status to 'approved'. Users may read their own row and create it
--    as pending; only admins (separate policy) may change status.
drop policy if exists "ShelterReq: user own" on public.pending_shelter_requests;
do $$ begin
  create policy "ShelterReq: user select own"
    on public.pending_shelter_requests for select
    to authenticated
    using (user_id = public.current_clerk_user_id());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "ShelterReq: user insert own"
    on public.pending_shelter_requests for insert
    to authenticated
    with check (
      user_id = public.current_clerk_user_id()
      and status = 'pending'
    );
exception when duplicate_object then null;
end $$;

-- 5) Ward images: uploads were accepted under any extension/MIME claimed by
--    the client. Restrict to raster image extensions (no svg/html/js).
drop policy if exists "Ward images: owner upload" on storage.objects;
do $$ begin
  create policy "Ward images: owner upload"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'ward-images'
      and (storage.foldername(name))[1] = public.current_clerk_user_id()
      and public.is_approved_sentinel(public.current_clerk_user_id())
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'avif')
    );
exception when duplicate_object then null;
end $$;
