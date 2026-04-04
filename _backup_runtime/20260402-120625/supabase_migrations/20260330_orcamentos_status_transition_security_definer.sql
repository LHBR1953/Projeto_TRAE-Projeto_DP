begin;

create or replace function public.occ_orcamento_auto_executado_on_item_finalizado()
returns trigger
language plpgsql
security definer
set search_path = public, auth
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

notify pgrst, 'reload schema';

commit;

