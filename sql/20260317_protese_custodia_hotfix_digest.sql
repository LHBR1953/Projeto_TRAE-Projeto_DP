begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.rpc_protese_custodia_get_token(p_token text)
returns table (
  empresa_id text,
  ordem_id uuid,
  ordem_seqid bigint,
  paciente_nome text,
  acao text,
  de_local text,
  para_local text,
  status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tok public.ordens_proteticas_custodia_tokens%rowtype;
  v_op public.ordens_proteticas%rowtype;
  v_pac_nome text;
begin
  select * into v_tok
  from public.ordens_proteticas_custodia_tokens
  where token = p_token
  limit 1;

  if not found then
    raise exception 'Token não encontrado';
  end if;

  if v_tok.status <> 'PENDENTE' then
    raise exception 'Token não está pendente';
  end if;

  if v_tok.expires_at <= timezone('utc'::text, now()) then
    update public.ordens_proteticas_custodia_tokens
    set status = 'EXPIRADO'
    where id = v_tok.id and status = 'PENDENTE';
    raise exception 'Token expirado';
  end if;

  select * into v_op
  from public.ordens_proteticas
  where id = v_tok.ordem_id
  limit 1;

  select p.nome into v_pac_nome
  from public.pacientes p
  where p.id = v_op.paciente_id
  limit 1;

  return query
  select
    v_tok.empresa_id,
    v_tok.ordem_id,
    v_op.seqid,
    coalesce(v_pac_nome, ''),
    v_tok.acao,
    v_tok.de_local,
    v_tok.para_local,
    v_tok.status,
    v_tok.expires_at;
end;
$$;

create or replace function public.rpc_protese_custodia_confirm(
  p_token text,
  p_code text,
  p_recebedor_nome text,
  p_recebedor_doc text,
  p_assinatura_base64 text,
  p_user_agent text
)
returns table (
  ok boolean,
  mensagem text,
  evento_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tok public.ordens_proteticas_custodia_tokens%rowtype;
  v_hash text;
  v_event_id uuid;
begin
  select * into v_tok
  from public.ordens_proteticas_custodia_tokens
  where token = p_token
  limit 1;

  if not found then
    return query select false, 'Token não encontrado', null::uuid;
    return;
  end if;

  if v_tok.status <> 'PENDENTE' then
    return query select false, 'Token já utilizado ou inválido', null::uuid;
    return;
  end if;

  if v_tok.expires_at <= timezone('utc'::text, now()) then
    update public.ordens_proteticas_custodia_tokens
    set status = 'EXPIRADO'
    where id = v_tok.id and status = 'PENDENTE';
    return query select false, 'Token expirado', null::uuid;
    return;
  end if;

  v_hash := encode(digest(coalesce(p_code, ''), 'sha256'), 'hex');
  if v_hash <> v_tok.challenge_hash then
    return query select false, 'Código inválido', null::uuid;
    return;
  end if;

  if coalesce(trim(p_recebedor_nome), '') = '' then
    return query select false, 'Informe o nome do recebedor', null::uuid;
    return;
  end if;

  update public.ordens_proteticas_custodia_tokens
  set status = 'CONFIRMADO',
      confirmed_at = timezone('utc'::text, now())
  where id = v_tok.id and status = 'PENDENTE';

  insert into public.ordens_proteticas_custodia_eventos (
    empresa_id,
    ordem_id,
    token_id,
    acao,
    de_local,
    para_local,
    recebedor_nome,
    recebedor_doc,
    assinatura_base64,
    user_agent,
    confirmed_at
  ) values (
    v_tok.empresa_id,
    v_tok.ordem_id,
    v_tok.id,
    v_tok.acao,
    v_tok.de_local,
    v_tok.para_local,
    trim(p_recebedor_nome),
    nullif(trim(coalesce(p_recebedor_doc, '')), ''),
    nullif(coalesce(p_assinatura_base64, ''), ''),
    nullif(coalesce(p_user_agent, ''), ''),
    timezone('utc'::text, now())
  )
  returning id into v_event_id;

  return query select true, 'Confirmado', v_event_id;
end;
$$;

grant execute on function public.rpc_protese_custodia_get_token(text) to anon, authenticated;
grant execute on function public.rpc_protese_custodia_confirm(text, text, text, text, text, text) to anon, authenticated;

commit;

