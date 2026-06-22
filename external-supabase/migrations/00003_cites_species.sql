-- CITES Species Reference
-- Cleaned and imported from the CITES Species Index (2026-06-06).
-- Each entry represents a taxonomic group (species, genus, family, etc.)
-- with its CITES appendix listing.

-- Enable pg_trgm for fuzzy text search
create extension if not exists pg_trgm;

create table if not exists public.cites_species (
  id                integer primary key,
  full_name         text not null,          -- canonical scientific name
  rank              text not null,          -- SPECIES | GENUS | FAMILY | ORDER | SUBSPECIES | SUBFAMILY | VARIETY
  class_name        text,                   -- e.g. Aves, Mammalia, Reptilia
  order_name        text,                   -- e.g. Apodiformes, Carnivora
  family_name       text,                   -- e.g. Trochilidae, Felidae
  genus_name        text,                   -- e.g. Abeillia, Panthera
  species_name      text,                   -- e.g. abeillei, leo
  cites_accepted    boolean not null default true,
  english_names     text[] not null default '{}',
  current_listing   text,                   -- I | II | III | I/II | I/II/NC | etc.
  listing_changes   jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

comment on table public.cites_species is 'CITES-listed species reference data (Index of CITES Species 2026)';
comment on column public.cites_species.current_listing is 'CITES appendix(es). Compound values (e.g. I/II) mean different populations have different listings.';
comment on column public.cites_species.rank is 'Taxonomic rank: SPECIES, GENUS, FAMILY, ORDER, SUBSPECIES, SUBFAMILY, or VARIETY';

-- Fuzzy search on scientific name (for autocomplete)
create index if not exists idx_cites_species_full_name_trgm
  on public.cites_species using gin (full_name gin_trgm_ops);

-- Exact lookup by full name
create index if not exists idx_cites_species_full_name
  on public.cites_species (full_name);

-- Filter by taxonomic rank
create index if not exists idx_cites_species_rank
  on public.cites_species (rank);

-- Filter by family
create index if not exists idx_cites_species_family
  on public.cites_species (family_name);

-- Filter by listing appendix
create index if not exists idx_cites_species_listing
  on public.cites_species (current_listing);

-- GIN index for searching inside english_names array
create index if not exists idx_cites_species_english_names
  on public.cites_species using gin (english_names);

-- RLS: reference data is readable by all authenticated users.
-- Writes come from the seed script (secret/service_role key, bypasses RLS).
alter table public.cites_species enable row level security;

drop policy if exists "CITES: public select" on public.cites_species;
create policy "CITES: public select"
  on public.cites_species for select
  to authenticated
  using (true);

-- Grant access to service_role (used by sb_secret_ keys for seed scripts)
grant all on public.cites_species to service_role;
grant all on public.cites_species_id_seq to service_role;
