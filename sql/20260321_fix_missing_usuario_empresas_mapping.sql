-- Use no Supabase SQL Editor
-- 1) Troque os valores abaixo:
--    - p_email: email do usuário que não consegue logar
--    - p_empresa: id da empresa (ex: emp_dbtech)
--    - p_perfil: admin/dentista/recepcao

begin;

do $$
declare
  p_email text := 'COLOQUE_O_EMAIL_AQUI';
  p_empresa text := 'emp_dbtech';
  p_perfil text := 'admin';
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  if v_user_id is null then
    raise exception 'Usuário não encontrado em auth.users para email=%', p_email;
  end if;

  if not exists (select 1 from public.empresas e where e.id = p_empresa) then
    raise exception 'Empresa não existe em public.empresas: %', p_empresa;
  end if;

  insert into public.usuario_empresas (usuario_id, empresa_id, perfil, user_email, permissoes)
  values (v_user_id, p_empresa, p_perfil, p_email, '{}'::jsonb)
  on conflict (usuario_id, empresa_id)
  do update set
    perfil = excluded.perfil,
    user_email = excluded.user_email;
end $$;

commit;

