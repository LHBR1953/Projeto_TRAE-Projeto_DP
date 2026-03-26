begin;

alter table public.marketing_smtp_config
  add column if not exists brevo_api_key text;

create or replace function public.rpc_marketing_get_smtp_config(p_empresa_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r public.marketing_smtp_config%rowtype;
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.occ_is_super_admin()) then
    raise exception 'Acesso negado.';
  end if;

  select * into r
  from public.marketing_smtp_config
  where empresa_id = p_empresa_id;

  if not found then
    return jsonb_build_object(
      'empresa_id', p_empresa_id,
      'enabled', false,
      'host', null,
      'port', null,
      'username', null,
      'from_email', null,
      'from_name', null,
      'has_password', false,
      'has_brevo_api_key', false
    );
  end if;

  return jsonb_build_object(
    'empresa_id', r.empresa_id,
    'enabled', r.enabled,
    'host', r.host,
    'port', r.port,
    'username', r.username,
    'from_email', r.from_email,
    'from_name', r.from_name,
    'has_password', (r.password is not null and btrim(r.password) <> ''),
    'has_brevo_api_key', (r.brevo_api_key is not null and btrim(r.brevo_api_key) <> '')
  );
end;
$$;

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
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.occ_is_super_admin()) then
    raise exception 'Acesso negado.';
  end if;

  select password, from_email, from_name, brevo_api_key
  into v_password, v_from_email, v_from_name, v_api_key
  from public.marketing_smtp_config
  where empresa_id = p_empresa_id;

  if p_password is not null and btrim(p_password) <> '' then
    v_password := p_password;
  end if;

  if p_from_email is not null and btrim(p_from_email) <> '' then
    v_from_email := p_from_email;
  end if;

  if p_from_name is not null and btrim(p_from_name) <> '' then
    v_from_name := p_from_name;
  end if;

  if p_brevo_api_key is not null and btrim(p_brevo_api_key) <> '' then
    v_api_key := p_brevo_api_key;
  end if;

  insert into public.marketing_smtp_config(
    empresa_id, enabled, host, port, username, password, from_email, from_name, brevo_api_key, updated_at
  )
  values (
    p_empresa_id,
    coalesce(p_enabled, true),
    coalesce(p_host, ''),
    coalesce(p_port, 587),
    p_username,
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

