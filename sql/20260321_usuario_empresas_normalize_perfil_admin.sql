begin;

update public.usuario_empresas
set perfil = 'admin'
where lower(perfil) in ('admim', 'administrador', 'administrator');

notify pgrst, 'reload schema';

commit;

