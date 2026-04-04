begin;

create or replace function public.rpc_protese_custodia_issue_token(
  p_empresa_id text,
  p_ordem_id uuid,
  p_acao text,
  p_de_local text,
  p_para_local text,
  p_ttl_minutes int default 10
)
returns table (
  ok boolean,
  message text,
  token text,
  code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_member boolean;
  v_op public.ordens_proteticas%rowtype;
  v_token text;
  v_code text;
  v_hash text;
  v_exp timestamptz;
  v_ttl int;
begin
  select exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id::text = auth.uid()::text
      and ue.empresa_id = p_empresa_id
  ) into v_member;

  if not (v_member or public.is_superadmin()) then
    return query select false, 'Sem permissão.', null::text, null::text, null::timestamptz;
    return;
  end if;

  select *
  into v_op
  from public.ordens_proteticas
  where empresa_id = p_empresa_id
    and id = p_ordem_id
  limit 1;

  if not found then
    return query select false, 'OP não encontrada.', null::text, null::text, null::timestamptz;
    return;
  end if;

  if coalesce(p_acao, '') not in ('ENTREGA','RECEBIMENTO') then
    return query select false, 'Ação inválida.', null::text, null::text, null::timestamptz;
    return;
  end if;

  if coalesce(trim(p_de_local), '') = '' or coalesce(trim(p_para_local), '') = '' then
    return query select false, 'Informe De/Para.', null::text, null::text, null::timestamptz;
    return;
  end if;

  v_ttl := greatest(2, least(coalesce(p_ttl_minutes, 10), 60));
  v_exp := timezone('utc'::text, now()) + (v_ttl || ' minutes')::interval;

  update public.ordens_proteticas_custodia_tokens
  set status = 'CANCELADO'
  where empresa_id = p_empresa_id
    and ordem_id = p_ordem_id
    and status = 'PENDENTE';

  v_token := encode(gen_random_bytes(16), 'hex');
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_hash := encode(digest(coalesce(v_code, ''), 'sha256'), 'hex');

  insert into public.ordens_proteticas_custodia_tokens (
    empresa_id,
    ordem_id,
    token,
    challenge_hash,
    acao,
    de_local,
    para_local,
    status,
    expires_at,
    created_by
  ) values (
    p_empresa_id,
    p_ordem_id,
    v_token,
    v_hash,
    p_acao,
    trim(p_de_local),
    trim(p_para_local),
    'PENDENTE',
    v_exp,
    auth.uid()
  );

  return query select true, 'QR gerado.', v_token, v_code, v_exp;
end;
$$;

grant execute on function public.rpc_protese_custodia_issue_token(text, uuid, text, text, text, int) to authenticated;

notify pgrst, 'reload schema';

commit;

