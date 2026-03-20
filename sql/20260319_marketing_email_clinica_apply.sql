begin;

alter table public.marketing_smtp_config
  add column if not exists from_email text;

alter table public.marketing_smtp_config
  add column if not exists from_name text;

update public.marketing_smtp_config
set from_email = username
where (from_email is null or btrim(from_email) = '')
  and username is not null
  and position('@' in username) > 1;

create or replace function public.rpc_marketing_set_smtp_config(
  p_empresa_id text,
  p_enabled boolean,
  p_host text,
  p_port integer,
  p_username text,
  p_password text,
  p_from_email text,
  p_from_name text
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
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.occ_is_super_admin()) then
    raise exception 'Acesso negado.';
  end if;

  select password, from_email, from_name
  into v_password, v_from_email, v_from_name
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

  insert into public.marketing_smtp_config(
    empresa_id, enabled, host, port, username, password, from_email, from_name, updated_at
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
    updated_at = now();

  return public.rpc_marketing_get_smtp_config(p_empresa_id);
end;
$$;

notify pgrst, 'reload schema';

commit;

