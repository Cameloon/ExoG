-- Store the CITES appendix resolved from cites_species at ward creation time.
-- Snapshot (not FK): the listing at intake is what matters legally, even if
-- the reference table is re-imported later.
alter table public.ward_listings
  add column if not exists cites_listing text;

comment on column public.ward_listings.cites_listing is
  'CITES appendix at intake, snapshotted from cites_species.current_listing by the ward form.';
