begin;

alter table public.usuario_empresas
  add column if not exists user_email text;

update public.usuario_empresas ue
set user_email = au.email
from auth.users au
where ue.usuario_id = au.id
  and (ue.user_email is null or btrim(ue.user_email) = '');

notify pgrst, 'reload schema';

commit;

