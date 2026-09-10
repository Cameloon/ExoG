-- 00033: Sentinel-side UI dismissal for shelter requests.
--
-- "Zurückziehen" (open requests) deletes the row and cancels the application.
-- "Ausblenden" only hides the entry from the sentinel's own list while the
-- relationship stays intact — e.g. an accepted request keeps the sentinel
-- connected to the shelter, but no longer clutters "Meine Anfragen".
--
-- The existing "ShelterReq: sentinel own" policy (FOR ALL, sentinel_id =
-- current user) already permits the sentinel to flip this flag on their row.

alter table public.sentinel_shelter_requests
  add column if not exists sentinel_hidden boolean not null default false;
