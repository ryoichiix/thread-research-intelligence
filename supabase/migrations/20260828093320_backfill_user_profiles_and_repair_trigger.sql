create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, 'researcher'), '@', 1)
    )
  )
  on conflict (id) do update
    set display_name = coalesce(public.users.display_name, excluded.display_name),
        updated_at = now();
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

insert into public.users (id, display_name)
select
  au.id,
  coalesce(
    nullif(au.raw_user_meta_data ->> 'display_name', ''),
    nullif(au.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(au.email, 'researcher'), '@', 1)
  )
from auth.users au
on conflict (id) do update
  set display_name = coalesce(public.users.display_name, excluded.display_name),
      updated_at = now();
