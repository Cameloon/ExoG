-- 00031: change_log trigger must survive service-role deletes.
--
-- log_change() wrote actor_id = current_clerk_user_id(). Under a
-- service-role request (account deletion, admin tooling) auth.jwt() has no
-- 'sub' claim → actor_id NULL → NOT NULL violation → the DELETE that fired
-- the trigger fails, breaking GDPR deletion of ward/shelter rows.
-- Anonymize the actor instead of crashing.

create or replace function public.log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.change_log (actor_id, action, table_name, record_id)
  values (
    coalesce(public.current_clerk_user_id(), 'service'),
    tg_op,
    tg_table_name,
    coalesce((old.id)::text, (new.id)::text, 'unknown')
  );
  return coalesce(new, old);
end;
$$;
