begin;

create or replace function public.occ_orcamento_auto_executado_on_item_finalizado()
returns trigger
language plpgsql
as $$
declare
  v_parent_status text;
  v_parent_status_key text;
  v_new_status_key text;
  v_old_status_key text;
  v_total_items integer;
  v_has_open boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  v_new_status_key := trim(lower(coalesce(new.status, '')));
  v_old_status_key := trim(lower(coalesce(old.status, '')));

  if v_new_status_key not in ('finalizado', 'concluido', 'concluído') then
    return new;
  end if;

  if v_old_status_key in ('finalizado', 'concluido', 'concluído') then
    return new;
  end if;

  select o.status
  into v_parent_status
  from public.orcamentos o
  where o.id = new.orcamento_id
    and o.empresa_id = new.empresa_id;

  if not found then
    return new;
  end if;

  v_parent_status_key := trim(lower(coalesce(v_parent_status, '')));
  if v_parent_status_key in ('cancelado', 'executado') then
    return new;
  end if;

  select count(*)
  into v_total_items
  from public.orcamento_itens i
  where i.empresa_id = new.empresa_id
    and i.orcamento_id = new.orcamento_id;

  if coalesce(v_total_items, 0) = 0 then
    return new;
  end if;

  select exists (
    select 1
    from public.orcamento_itens i
    where i.empresa_id = new.empresa_id
      and i.orcamento_id = new.orcamento_id
      and trim(lower(coalesce(i.status, ''))) not in ('finalizado', 'concluido', 'concluído', 'cancelado', 'cancelada')
    limit 1
  )
  into v_has_open;

  if not v_has_open then
    update public.orcamentos
    set status = 'Executado'
    where id = new.orcamento_id
      and empresa_id = new.empresa_id
      and trim(lower(coalesce(status, ''))) not in ('executado', 'cancelado');
    return new;
  end if;

  if v_total_items > 1 and v_parent_status_key = 'aprovado' then
    update public.orcamentos
    set status = 'Pendente'
    where id = new.orcamento_id
      and empresa_id = new.empresa_id
      and trim(lower(coalesce(status, ''))) = 'aprovado';
  end if;

  return new;
end;
$$;

drop trigger if exists occ_trg_orcamento_auto_executado_on_item_finalizado on public.orcamento_itens;
create trigger occ_trg_orcamento_auto_executado_on_item_finalizado
after update of status on public.orcamento_itens
for each row
execute function public.occ_orcamento_auto_executado_on_item_finalizado();

create or replace function public.rpc_try_close_orcamento(p_empresa_id text, p_orcamento_id text)
returns table(updated boolean, status text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_status text;
  v_status_key text;
  v_has_open boolean;
begin
  if p_empresa_id is null or length(trim(p_empresa_id)) = 0 then
    raise exception 'Missing p_empresa_id';
  end if;
  if p_orcamento_id is null or length(trim(p_orcamento_id)) = 0 then
    raise exception 'Missing p_orcamento_id';
  end if;

  if not exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = p_empresa_id
  ) then
    raise exception 'Forbidden';
  end if;

  select o.status
  into v_status
  from public.orcamentos o
  where o.empresa_id = p_empresa_id
    and o.id = p_orcamento_id
  for update;

  if not found then
    updated := false;
    status := null;
    return next;
    return;
  end if;

  v_status_key := trim(lower(coalesce(v_status, '')));
  if v_status_key in ('executado', 'cancelado') then
    updated := false;
    status := v_status;
    return next;
    return;
  end if;

  select exists (
    select 1
    from public.orcamento_itens i
    where i.empresa_id = p_empresa_id
      and i.orcamento_id = p_orcamento_id
      and trim(lower(coalesce(i.status, ''))) not in ('finalizado', 'concluido', 'concluído', 'cancelado', 'cancelada')
    limit 1
  )
  into v_has_open;

  if v_has_open then
    updated := false;
    status := v_status;
    return next;
    return;
  end if;

  update public.orcamentos
  set status = 'Executado'
  where empresa_id = p_empresa_id
    and id = p_orcamento_id
    and trim(lower(coalesce(status, ''))) not in ('executado', 'cancelado');

  updated := true;
  status := 'Executado';
  return next;
end;
$$;

grant execute on function public.rpc_try_close_orcamento(text, text) to authenticated;

notify pgrst, 'reload schema';

commit;

