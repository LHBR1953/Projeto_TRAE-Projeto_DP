begin;

create or replace function public.rpc_delete_ordem_protetica(p_empresa_id text, p_ordem_id uuid)
returns table (ok boolean, message text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_op public.ordens_proteticas%rowtype;
  v_has_pay boolean;
  v_has_cust boolean;
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.is_superadmin()) then
    return query select false, 'Sem permissão.';
    return;
  end if;

  select *
  into v_op
  from public.ordens_proteticas
  where empresa_id = p_empresa_id
    and id = p_ordem_id
  limit 1;

  if not found then
    return query select false, 'OP não encontrada.';
    return;
  end if;

  if coalesce(v_op.fase_atual, '') <> 'CRIADA'
     or coalesce(v_op.status_geral, '') not in ('EM_ANDAMENTO', 'PAUSADA') then
    return query select false, 'Só é possível excluir OP sem fluxo (fase CRIADA e status em andamento/pausada).';
    return;
  end if;

  if to_regclass('public.protese_contas_pagar') is not null then
    select exists (
      select 1
      from public.protese_contas_pagar p
      where p.empresa_id = p_empresa_id
        and p.ordem_id = p_ordem_id
    ) into v_has_pay;
    if v_has_pay then
      return query select false, 'Não é possível excluir: existe conta a pagar vinculada à OP.';
      return;
    end if;
  end if;

  if to_regclass('public.ordens_proteticas_custodia_eventos') is not null then
    select exists (
      select 1
      from public.ordens_proteticas_custodia_eventos e
      where e.empresa_id = p_empresa_id
        and e.ordem_id = p_ordem_id
    ) into v_has_cust;
    if v_has_cust then
      return query select false, 'Não é possível excluir: a OP já possui custódia (envio/recebimento).';
      return;
    end if;
  end if;

  if to_regclass('public.ordens_proteticas_anexos') is not null then
    delete from public.ordens_proteticas_anexos
    where empresa_id = p_empresa_id
      and ordem_id = p_ordem_id;
  end if;

  if to_regclass('public.ordens_proteticas_eventos') is not null then
    delete from public.ordens_proteticas_eventos
    where empresa_id = p_empresa_id
      and ordem_id = p_ordem_id;
  end if;

  if to_regclass('public.ordens_proteticas_custodia_tokens') is not null then
    delete from public.ordens_proteticas_custodia_tokens
    where empresa_id = p_empresa_id
      and ordem_id = p_ordem_id;
  end if;

  delete from public.ordens_proteticas
  where empresa_id = p_empresa_id
    and id = p_ordem_id;

  return query select true, 'OP excluída com sucesso.';
end;
$$;

grant execute on function public.rpc_delete_ordem_protetica(text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

