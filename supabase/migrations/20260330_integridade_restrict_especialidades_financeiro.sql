begin;

do $$
declare
  r record;
begin
  if to_regclass('public.especialidade_subdivisoes') is not null
     and to_regclass('public.especialidades') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='especialidade_subdivisoes' and column_name='especialidade_id')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.especialidade_subdivisoes'::regclass
        and c.confrelid = 'public.especialidades'::regclass
    loop
      execute format('alter table public.especialidade_subdivisoes drop constraint if exists %I', r.conname);
    end loop;
    alter table public.especialidade_subdivisoes
      add constraint especialidade_subdivisoes_especialidade_id_fkey
      foreign key (especialidade_id)
      references public.especialidades(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.profissionais') is not null
     and to_regclass('public.especialidades') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='profissionais' and column_name='especialidadeid')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.profissionais'::regclass
        and c.confrelid = 'public.especialidades'::regclass
    loop
      execute format('alter table public.profissionais drop constraint if exists %I', r.conname);
    end loop;
    alter table public.profissionais
      add constraint profissionais_especialidadeid_fkey
      foreign key (especialidadeid)
      references public.especialidades(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.servicos') is not null
     and to_regclass('public.especialidade_subdivisoes') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='servicos' and column_name='subdivisao_id')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.servicos'::regclass
        and c.confrelid = 'public.especialidade_subdivisoes'::regclass
    loop
      execute format('alter table public.servicos drop constraint if exists %I', r.conname);
    end loop;
    alter table public.servicos
      add constraint servicos_subdivisao_id_fkey
      foreign key (subdivisao_id)
      references public.especialidade_subdivisoes(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.orcamento_itens') is not null
     and to_regclass('public.servicos') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamento_itens' and column_name='servico_id')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.orcamento_itens'::regclass
        and c.confrelid = 'public.servicos'::regclass
    loop
      execute format('alter table public.orcamento_itens drop constraint if exists %I', r.conname);
    end loop;
    alter table public.orcamento_itens
      add constraint orcamento_itens_servico_id_fkey
      foreign key (servico_id)
      references public.servicos(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.orcamentos') is not null
     and to_regclass('public.empresas') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamentos' and column_name='empresa_id')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.orcamentos'::regclass
        and c.confrelid = 'public.empresas'::regclass
    loop
      execute format('alter table public.orcamentos drop constraint if exists %I', r.conname);
    end loop;
    alter table public.orcamentos
      add constraint orcamentos_empresa_id_fkey
      foreign key (empresa_id)
      references public.empresas(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.orcamento_pagamentos') is not null
     and to_regclass('public.empresas') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamento_pagamentos' and column_name='empresa_id')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.orcamento_pagamentos'::regclass
        and c.confrelid = 'public.empresas'::regclass
    loop
      execute format('alter table public.orcamento_pagamentos drop constraint if exists %I', r.conname);
    end loop;
    alter table public.orcamento_pagamentos
      add constraint orcamento_pagamentos_empresa_id_fkey
      foreign key (empresa_id)
      references public.empresas(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.financeiro_transacoes') is not null
     and to_regclass('public.empresas') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='financeiro_transacoes' and column_name='empresa_id')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.financeiro_transacoes'::regclass
        and c.confrelid = 'public.empresas'::regclass
    loop
      execute format('alter table public.financeiro_transacoes drop constraint if exists %I', r.conname);
    end loop;
    alter table public.financeiro_transacoes
      add constraint financeiro_transacoes_empresa_id_fkey
      foreign key (empresa_id)
      references public.empresas(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.financeiro_comissoes') is not null
     and to_regclass('public.empresas') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='financeiro_comissoes' and column_name='empresa_id')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.financeiro_comissoes'::regclass
        and c.confrelid = 'public.empresas'::regclass
    loop
      execute format('alter table public.financeiro_comissoes drop constraint if exists %I', r.conname);
    end loop;
    alter table public.financeiro_comissoes
      add constraint financeiro_comissoes_empresa_id_fkey
      foreign key (empresa_id)
      references public.empresas(id)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.financeiro_comissoes') is not null
     and to_regclass('public.orcamento_itens') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='financeiro_comissoes' and column_name='item_id')
  then
    for r in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.financeiro_comissoes'::regclass
        and c.confrelid = 'public.orcamento_itens'::regclass
    loop
      execute format('alter table public.financeiro_comissoes drop constraint if exists %I', r.conname);
    end loop;
    alter table public.financeiro_comissoes
      add constraint financeiro_comissoes_item_id_fkey
      foreign key (item_id)
      references public.orcamento_itens(id)
      on delete restrict
      not valid;
  end if;
end $$;

create or replace function public.occ_block_delete_financeiro_transacoes()
returns trigger
language plpgsql
as $$
declare
  v_role text;
begin
  v_role := coalesce(auth.jwt() ->> 'role', '');
  if v_role = 'service_role' or current_user = 'postgres' then
    return old;
  end if;
  raise exception 'Integridade de Dados: não é permitido excluir lançamentos financeiros. Sugerimos estornar para manter histórico contábil.';
end;
$$;

do $$
begin
  if to_regclass('public.financeiro_transacoes') is null then
    return;
  end if;
  drop trigger if exists occ_trg_financeiro_transacoes_block_delete on public.financeiro_transacoes;
  create trigger occ_trg_financeiro_transacoes_block_delete
  before delete on public.financeiro_transacoes
  for each row
  execute function public.occ_block_delete_financeiro_transacoes();
end $$;

create or replace function public.occ_block_delete_especialidades()
returns trigger
language plpgsql
as $$
declare
  v_role text;
  has_any boolean;
begin
  v_role := coalesce(auth.jwt() ->> 'role', '');
  if v_role = 'service_role' or current_user = 'postgres' then
    return old;
  end if;

  if to_regclass('public.profissionais') is not null then
    select exists (
      select 1 from public.profissionais p
      where p.empresa_id = old.empresa_id
        and p.especialidadeid = old.id
      limit 1
    ) into has_any;
    if has_any then
      raise exception 'Integridade de Dados: não é possível excluir especialidade pois existem profissionais vinculados.';
    end if;
  end if;

  if to_regclass('public.especialidade_subdivisoes') is not null then
    select exists (
      select 1 from public.especialidade_subdivisoes s
      where s.empresa_id = old.empresa_id
        and s.especialidade_id = old.id
      limit 1
    ) into has_any;
    if has_any then
      raise exception 'Integridade de Dados: não é possível excluir especialidade pois existem subdivisões vinculadas.';
    end if;
  end if;

  return old;
end;
$$;

do $$
begin
  if to_regclass('public.especialidades') is null then
    return;
  end if;
  drop trigger if exists occ_trg_especialidades_block_delete on public.especialidades;
  create trigger occ_trg_especialidades_block_delete
  before delete on public.especialidades
  for each row
  execute function public.occ_block_delete_especialidades();
end $$;

create or replace function public.occ_block_delete_especialidade_subdivisoes()
returns trigger
language plpgsql
as $$
declare
  v_role text;
  has_any boolean;
begin
  v_role := coalesce(auth.jwt() ->> 'role', '');
  if v_role = 'service_role' or current_user = 'postgres' then
    return old;
  end if;

  if to_regclass('public.servicos') is not null then
    select exists (
      select 1 from public.servicos s
      where s.empresa_id = old.empresa_id
        and s.subdivisao_id = old.id
      limit 1
    ) into has_any;
    if has_any then
      raise exception 'Integridade de Dados: não é possível excluir subdivisão pois existem serviços vinculados.';
    end if;
  end if;

  return old;
end;
$$;

do $$
begin
  if to_regclass('public.especialidade_subdivisoes') is null then
    return;
  end if;
  drop trigger if exists occ_trg_especialidade_subdivisoes_block_delete on public.especialidade_subdivisoes;
  create trigger occ_trg_especialidade_subdivisoes_block_delete
  before delete on public.especialidade_subdivisoes
  for each row
  execute function public.occ_block_delete_especialidade_subdivisoes();
end $$;

notify pgrst, 'reload schema';

commit;
