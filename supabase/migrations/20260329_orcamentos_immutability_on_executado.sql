begin;

create or replace function public.occ_block_orcamentos_mutation_when_executado()
returns trigger
language plpgsql
as $$
declare
  v_old_status text;
  v_role text;
begin
  v_role := coalesce(auth.jwt() ->> 'role', '');
  if v_role = 'service_role' or current_user = 'postgres' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_old_status := trim(lower(coalesce(old.status, '')));
  if v_old_status = 'executado' then
    raise exception 'Este orçamento já foi executado e não pode mais ser alterado por questões de segurança contábil.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.orcamentos') is null then
    return;
  end if;

  drop trigger if exists occ_trg_orcamentos_block_mutation_executado_upd on public.orcamentos;
  create trigger occ_trg_orcamentos_block_mutation_executado_upd
  before update on public.orcamentos
  for each row
  execute function public.occ_block_orcamentos_mutation_when_executado();

  drop trigger if exists occ_trg_orcamentos_block_mutation_executado_del on public.orcamentos;
  create trigger occ_trg_orcamentos_block_mutation_executado_del
  before delete on public.orcamentos
  for each row
  execute function public.occ_block_orcamentos_mutation_when_executado();
end $$;

notify pgrst, 'reload schema';

commit;

