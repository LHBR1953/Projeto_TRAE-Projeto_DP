begin;

create or replace function public.rpc_marketing_set_smtp_config(
  p_empresa_id text,
  p_enabled boolean,
  p_host text,
  p_port integer,
  p_username text,
  p_password text,
  p_from_email text,
  p_from_name text,
  p_brevo_api_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_password text;
  v_from_email text;
  v_from_name text;
  v_api_key text;
  v_enabled boolean;
  v_username text;
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.occ_is_super_admin()) then
    raise exception 'Acesso negado.';
  end if;

  v_enabled := coalesce(p_enabled, true);
  v_username := nullif(btrim(coalesce(p_username, '')), '');

  select password, from_email, from_name, brevo_api_key
  into v_password, v_from_email, v_from_name, v_api_key
  from public.marketing_smtp_config
  where empresa_id = p_empresa_id;

  if p_password is not null and btrim(p_password) <> '' then
    v_password := p_password;
  end if;

  if p_from_email is not null then
    v_from_email := nullif(btrim(p_from_email), '');
  end if;

  if p_from_name is not null then
    v_from_name := nullif(btrim(p_from_name), '');
  end if;

  if p_brevo_api_key is not null then
    v_api_key := nullif(btrim(p_brevo_api_key), '');
  end if;

  if v_enabled and nullif(btrim(coalesce(v_from_email, '')), '') is null then
    raise exception 'E-mail da clínica (From.Address) é obrigatório.';
  end if;

  if v_enabled and v_username is not null and nullif(btrim(coalesce(v_password, '')), '') is null then
    raise exception 'SMTP.Password é obrigatória para envio via SMTP.';
  end if;

  insert into public.marketing_smtp_config(
    empresa_id, enabled, host, port, username, password, from_email, from_name, brevo_api_key, updated_at
  )
  values (
    p_empresa_id,
    v_enabled,
    coalesce(p_host, ''),
    coalesce(p_port, 587),
    v_username,
    v_password,
    v_from_email,
    v_from_name,
    v_api_key,
    now()
  )
  on conflict (empresa_id) do update set
    enabled = excluded.enabled,
    host = excluded.host,
    port = excluded.port,
    username = excluded.username,
    password = excluded.password,
    from_email = excluded.from_email,
    from_name = excluded.from_name,
    brevo_api_key = excluded.brevo_api_key,
    updated_at = now();

  return public.rpc_marketing_get_smtp_config(p_empresa_id);
end;
$$;

grant execute on function public.rpc_marketing_set_smtp_config(text, boolean, text, integer, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;

