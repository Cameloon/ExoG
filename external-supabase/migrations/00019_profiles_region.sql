-- Allow behoerde users to self-set their region (no sentinel application path).
alter table public.profiles add column if not exists region text;
