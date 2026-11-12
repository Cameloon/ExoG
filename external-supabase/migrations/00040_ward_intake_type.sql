begin;
-- Existing cases remain explicitly unknown; neither custody nor free text
-- proves whether an animal was found, surrendered or confiscated.
alter table public.ward_listings add column if not exists intake_type text not null default 'unknown';
alter table public.ward_listings add constraint ward_intake_type_valid
  check (intake_type in ('confiscated','found','surrendered','transferred','unknown'));
comment on column public.ward_listings.intake_type is 'Recorded intake reason for document recommendations; not a determination of legal ownership.';
commit;
