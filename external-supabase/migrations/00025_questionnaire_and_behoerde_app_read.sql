-- 00025: Adoption-questionnaire data flow.
--
-- 1) ward_interest.consultation_requested — the animal-specific part of the
--    placement questionnaire ("Beratungsgespräch gewünscht?") is asked per
--    inquiry, not per application.
-- 2) Behörden read sentinel_applications in their region — the questionnaire
--    data (stored in pledge_data) must be reviewable by the overseeing
--    authority, not only by shelters and admins. Region scope comes from
--    profiles.region (set by an admin, or self-set per 00019).

alter table public.ward_interest
  add column if not exists consultation_requested boolean not null default false;

drop policy if exists "Apps: behoerde select region" on public.sentinel_applications;
do $$ begin
  create policy "Apps: behoerde select region"
    on public.sentinel_applications for select
    to authenticated
    using (
      (auth.jwt() ->> 'n') in ('behoerde', 'gov')
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
exception when duplicate_object then null;
end $$;
