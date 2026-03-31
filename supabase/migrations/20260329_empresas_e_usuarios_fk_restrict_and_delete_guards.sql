begin;

do $$
declare
  r record;
  def text;
  newdef text;
begin
  if to_regclass('public.empresas') is not null then
    for r in
      select
        c.oid,
        c.conname,
        c.conrelid::regclass as tbl,
        pg_get_constraintdef(c.oid, true) as condef
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      where c.contype = 'f'
        and c.confrelid = 'public.empresas'::regclass
        and n.nspname = 'public'
    loop
      def := r.condef;
      newdef := regexp_replace(def, 'ON DELETE\\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)', 'ON DELETE RESTRICT', 'gi');
      if newdef = def and position('ON DELETE' in upper(def)) = 0 then
        newdef := def || ' ON DELETE RESTRICT';
      end if;
      execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
      execute format('alter table %s add constraint %I %s not valid', r.tbl, r.conname, newdef);
    end loop;
  end if;

  if to_regclass('auth.users') is not null then
    for r in
      select
        c.oid,
        c.conname,
        c.conrelid::regclass as tbl,
        pg_get_constraintdef(c.oid, true) as condef
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      where c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass
        and n.nspname = 'public'
    loop
      def := r.condef;
      newdef := regexp_replace(def, 'ON DELETE\\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)', 'ON DELETE RESTRICT', 'gi');
      if newdef = def and position('ON DELETE' in upper(def)) = 0 then
        newdef := def || ' ON DELETE RESTRICT';
      end if;
      execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
      execute format('alter table %s add constraint %I %s not valid', r.tbl, r.conname, newdef);
    end loop;
  end if;
end $$;

create or replace function public.occ_block_empresa_delete_if_any_dependency()
returns trigger
language plpgsql
as $$
declare
  r record;
  has_rows boolean;
begin
  for r in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'empresa_id'
      and c.table_name <> 'empresas'
  loop
    execute format('select exists(select 1 from public.%I where empresa_id = $1 limit 1)', r.table_name)
      into has_rows
      using old.id;
    if has_rows then
      raise exception 'Não é possível excluir este registro pois ele possui movimentações vinculadas. Sugerimos apenas inativar.';
    end if;
  end loop;
  return old;
end;
$$;

do $$
begin
  if to_regclass('public.empresas') is null then
    return;
  end if;
  drop trigger if exists occ_trg_empresas_block_delete on public.empresas;
  create trigger occ_trg_empresas_block_delete
  before delete on public.empresas
  for each row
  execute function public.occ_block_empresa_delete_if_any_dependency();
end $$;

create or replace function public.occ_block_usuario_empresas_delete_if_history()
returns trigger
language plpgsql
as $$
declare
  r record;
  has_rows boolean;
begin
  for r in
    select distinct c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.columns e
      on e.table_schema = c.table_schema
     and e.table_name = c.table_name
     and e.column_name = 'empresa_id'
    where c.table_schema = 'public'
      and c.column_name in ('created_by', 'criado_por', 'usuario_id', 'user_id')
      and c.table_name not in ('usuario_empresas')
  loop
    execute format('select exists(select 1 from public.%I where empresa_id = $1 and %I = $2 limit 1)', r.table_name, r.column_name)
      into has_rows
      using old.empresa_id, old.usuario_id;
    if has_rows then
      raise exception 'Não é possível excluir este registro pois ele possui movimentações vinculadas. Sugerimos apenas inativar.';
    end if;
  end loop;
  return old;
end;
$$;

do $$
begin
  if to_regclass('public.usuario_empresas') is null then
    return;
  end if;
  drop trigger if exists occ_trg_usuario_empresas_block_delete_history on public.usuario_empresas;
  create trigger occ_trg_usuario_empresas_block_delete_history
  before delete on public.usuario_empresas
  for each row
  execute function public.occ_block_usuario_empresas_delete_if_history();
end $$;

notify pgrst, 'reload schema';

commit;
