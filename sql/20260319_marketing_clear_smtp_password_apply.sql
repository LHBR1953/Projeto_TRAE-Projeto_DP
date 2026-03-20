begin;

create or replace function public.rpc_marketing_clear_smtp_password(p_empresa_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.occ_is_super_admin()) then
    raise exception 'Acesso negado.';
  end if;

  update public.marketing_smtp_config
  set password = null,
      updated_at = now()
  where empresa_id = p_empresa_id;

  return public.rpc_marketing_get_smtp_config(p_empresa_id);
end;
$$;

grant execute on function public.rpc_marketing_clear_smtp_password(text) to authenticated;

notify pgrst, 'reload schema';

commit;

