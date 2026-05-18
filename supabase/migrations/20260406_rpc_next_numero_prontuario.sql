create or replace function public.rpc_next_numero_prontuario(p_empresa_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text := trim(coalesce(p_empresa_id, ''));
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_max_pr int := 0;
  v_max_seq int := 0;
  v_next int := 1;
begin
  if v_emp = '' then
    raise exception 'empresa_id inválido.';
  end if;

  if v_uid is null and v_role <> 'service_role' then
    raise exception 'Usuário não autenticado.';
  end if;

  if v_uid is not null then
    if not exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_uid
        and ue.empresa_id = v_emp
    ) then
      raise exception 'Sem permissão para consultar esta empresa.';
    end if;
  end if;

  select coalesce(max((numero_prontuario)::int), 0)
    into v_max_pr
  from public.pacientes
  where empresa_id = v_emp
    and numero_prontuario ~ '^[0-9]+$';

  select coalesce(max(seqid), 0)
    into v_max_seq
  from public.pacientes
  where empresa_id = v_emp;

  v_next := greatest(v_max_pr, v_max_seq) + 1;
  return v_next::text;
end;
$$;

notify pgrst, 'reload schema';
