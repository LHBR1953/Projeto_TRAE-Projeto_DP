begin;

do $$
declare
  full_perms jsonb := jsonb_build_object(
    'dashboard', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'pacientes', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'profissionais', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'especialidades', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'servicos', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'orcamentos', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'financeiro', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'comissoes', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'marketing', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'atendimento', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'agenda', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true),
    'protese', jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true)
  );
begin
  if to_regclass('public.usuario_empresas') is not null then
    alter table public.usuario_empresas add column if not exists permissoes jsonb default '{}'::jsonb;
    update public.usuario_empresas
    set perfil = 'admin',
        permissoes = full_perms
    where lower(coalesce(perfil, '')) in ('admin','admim','administrador','administrator');
  end if;

  if to_regclass('public.empresa_usuarios') is not null then
    alter table public.empresa_usuarios add column if not exists permissoes jsonb default '{}'::jsonb;
    update public.empresa_usuarios
    set perfil = 'admin',
        permissoes = full_perms
    where lower(coalesce(perfil, '')) in ('admin','admim','administrador','administrator');
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
