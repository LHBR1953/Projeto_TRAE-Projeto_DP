begin;

alter table public.empresas
  add column if not exists financeiro_params jsonb not null default '{}'::jsonb;

create or replace function public.rpc_update_empresa_financeiro_params(
  p_empresa_id text,
  p_financeiro_params jsonb
)
returns public.empresas
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.empresas%rowtype;
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.is_superadmin()) then
    raise exception 'Acesso negado.';
  end if;

  update public.empresas
  set financeiro_params = coalesce(p_financeiro_params, '{}'::jsonb)
  where id = p_empresa_id
  returning * into v_row;

  if not found then
    raise exception 'Empresa não encontrada.';
  end if;

  return v_row;
end;
$$;

grant execute on function public.rpc_update_empresa_financeiro_params(text, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
