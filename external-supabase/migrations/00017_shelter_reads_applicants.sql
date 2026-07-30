-- 00017: A shelter may read the applications of sentinels who applied to
-- THEIR shelter — that is the whole point of the application: review the
-- applicant (Klarname, experience, motivation) before accepting.
-- KYC documents stay admin-only; this exposes application fields only.
-- ponytail: any request status counts (incl. declined) — a shelter that once
-- reviewed an applicant keeps read access; scoping to open/accepted adds
-- churn for no real privacy gain (the data was already shown during review).

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
    ));
exception when duplicate_object then null;
end $$;
