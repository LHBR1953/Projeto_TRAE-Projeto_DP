begin;

create or replace function public.occ_orcamento_auto_executado_on_item_finalizado()
returns trigger
language plpgsql
as $$
declare
  v_parent_status text;
  v_has_open boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status is null then
    return new;
  end if;

  if lower(new.status) not in ('finalizado', 'concluido', 'concluído') then
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

  if lower(coalesce(v_parent_status, '')) not in ('aprovado', 'em andamento', 'em_andamento', 'em execucao', 'em execução') then
    return new;
  end if;

  select exists (
    select 1
    from public.orcamento_itens i
    where i.empresa_id = new.empresa_id
      and i.orcamento_id = new.orcamento_id
      and lower(coalesce(i.status, '')) not in ('finalizado', 'concluido', 'concluído')
    limit 1
  )
  into v_has_open;

  if v_has_open then
    return new;
  end if;

  update public.orcamentos
  set status = 'Executado'
  where id = new.orcamento_id
    and empresa_id = new.empresa_id;

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
