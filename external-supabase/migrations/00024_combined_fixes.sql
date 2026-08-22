-- 00024 (combined): run once after 00023.
-- Part A — audit fixes: quarantine gate, ward-image uploads for shelters,
-- votes after close, role-change audit log.
-- Part B — shelter accept/decline for ward applications (ward_interest).
-- All policy replacements are idempotent (drop + create); one new table.

-- ─────────────────────────── Part A ───────────────────────────

-- 1) Quarantine gate: "Platzierung" requires a lab report. Previously a ward
--    owner could self-certify quarantine_safe and place the animal with no
--    evidence (the UI enforced it, the RLS WITH CHECK did not).
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
      (status <> 'placed' or lab_report_path is not null)
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

-- 2) Ward images: shelter/einrichtung users upload ward photos in the UI
--    (Wards.tsx), but the policy only allowed approved sentinels → uploads
--    failed. Mirror the shelter branch of the "Wards: staff insert" policy.
drop policy if exists "Ward images: owner upload" on storage.objects;
create policy "Ward images: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ward-images'
    and (storage.foldername(name))[1] = public.current_clerk_user_id()
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'avif')
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

-- 3) Votes: a vote inserted after the request was resolved/closed would be
--    silently counted in the expert total. Only open requests may take votes.
drop policy if exists "Votes: expert insert" on public.identification_votes;
create policy "Votes: expert insert"
  on public.identification_votes for insert
  to authenticated
  with check (
    expert_id = public.current_clerk_user_id()
    and public.is_expert(public.current_clerk_user_id())
    and exists (
      select 1 from public.identification_requests r
      where r.id = request_id
        and r.status = 'open'
    )
  );

-- 4) Role-change audit: change_log is trigger-only (insert revoked) and has no
--    clerk-user concept, so admin role grants (set-user-role edge function) had
--    no persisted trace. Append-only log written by the admin UI.
create table if not exists public.role_change_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        text not null,
  target_user_id  text not null,
  role            text not null,
  region          text,
  changed_at      timestamptz not null default now()
);

alter table public.role_change_log enable row level security;

drop policy if exists "RoleChange: admin select" on public.role_change_log;
create policy "RoleChange: admin select"
  on public.role_change_log for select
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'));

drop policy if exists "RoleChange: admin insert" on public.role_change_log;
create policy "RoleChange: admin insert"
  on public.role_change_log for insert
  to authenticated
  with check (
    actor_id = public.current_clerk_user_id()
    and public.has_role(public.current_clerk_user_id(), 'admin')
  );

grant select, insert on public.role_change_log to authenticated;

-- ─────────────────────────── Part B ───────────────────────────

-- The sentinel writes ward_interest ("Interesse bekunden") but the shelter
-- could never read it in the UI and RLS had no shelter UPDATE policy —
-- the application was a dead end. This enables the decision step:
--   open/shortlisted --(shelter)--> matched | declined
-- ponytail: "matched" is the enum's acceptance state (adoption match);
-- assigning the ward itself stays a manual WardManager step.

-- 5) Shelter owner may decide on interest for their wards.
drop policy if exists "Interest: shelter owner update" on public.ward_interest;
create policy "Interest: shelter owner update"
  on public.ward_interest for update
  to authenticated
  using (
    exists (
      select 1 from public.ward_listings w
      join public.shelters s on s.id = w.shelter_id
      where w.id = ward_interest.ward_id
        and s.owner_id = public.current_clerk_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.ward_listings w
      join public.shelters s on s.id = w.shelter_id
      where w.id = ward_interest.ward_id
        and s.owner_id = public.current_clerk_user_id()
    )
    and status in ('open', 'shortlisted', 'matched', 'declined')
  );

-- 6) The shelter may read applicant profiles for ward applicants too —
--    previously only shelter_requests applicants were visible (00017),
--    so a ward application showed no name/experience to review.
drop policy if exists "Apps: shelter select applicants" on public.sentinel_applications;
do $$ begin
  create policy "Apps: shelter select applicants"
    on public.sentinel_applications for select
    to authenticated
    using (exists (
      select 1
      from public.sentinel_shelter_requests r
      join public.shelters s on s.id = r.shelter_id
      where r.sentinel_id = sentinel_applications.user_id
        and s.owner_id = public.current_clerk_user_id()
    )
    or exists (
      select 1
      from public.ward_interest i
      join public.ward_listings w on w.id = i.ward_id
      join public.shelters s on s.id = w.shelter_id
      where i.applicant_id = sentinel_applications.user_id
        and s.owner_id = public.current_clerk_user_id()
    ));
exception when duplicate_object then null;
end $$;
