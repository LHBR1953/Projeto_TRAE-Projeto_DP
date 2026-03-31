begin;

do $$
declare
  t text;
  has_col boolean;
  nullable text;
  null_count bigint;
  has_fk boolean;
  cname text;
  table_list text[];
begin
  table_list := ARRAY[
    'usuario_empresas',
    'pacientes',
    'paciente_evolucao',
    'paciente_documentos',
    'profissionais',
    'profissional_usuarios',
    'especialidades',
    'especialidade_subdivisoes',
    'servicos',
    'marketing_smtp_config',
    'marketing_campanhas',
    'marketing_envios',
    'orcamentos',
    'orcamento_itens',
    'orcamento_pagamentos',
    'agenda_disponibilidade',
    'agenda_agendamentos',
    'financeiro_transacoes',
    'financeiro_comissoes',
    'orcamento_cancelados',
    'auditoria_log',
    'occ_audit_log',
    'laboratorios_proteticos',
    'ordens_proteticas',
    'ordens_proteticas_eventos',
    'ordens_proteticas_anexos',
    'protese_contas_pagar',
    'ordens_proteticas_custodia_tokens',
    'ordens_proteticas_custodia_eventos'
  ];

  foreach t in array table_list loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'empresa_id'
    )
    into has_col;

    if not has_col then
      raise exception 'SaaS_Security_Shield: tabela public.% não possui coluna empresa_id', t;
    end if;

    execute format('select count(*) from public.%I where empresa_id is null', t) into null_count;
    if null_count > 0 then
      raise exception 'SaaS_Security_Shield: tabela public.% possui % registros com empresa_id NULL', t, null_count;
    end if;

    select c.is_nullable
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = t
      and c.column_name = 'empresa_id'
    into nullable;

    if nullable = 'YES' then
      execute format('alter table public.%I alter column empresa_id set not null', t);
    end if;

    select exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join unnest(con.conkey) with ordinality as u(attnum, ord) on true
      join pg_attribute a on a.attrelid = rel.oid and a.attnum = u.attnum
      where con.contype = 'f'
        and ns.nspname = 'public'
        and rel.relname = t
        and con.confrelid = 'public.empresas'::regclass
        and a.attname = 'empresa_id'
    )
    into has_fk;

    if not has_fk then
      cname := t || '_empresa_id_fkey';
      if length(cname) > 63 then
        cname := substr(cname, 1, 63);
      end if;
      execute format(
        'alter table public.%I add constraint %I foreign key (empresa_id) references public.empresas(id) on delete restrict',
        t,
        cname
      );
    end if;
  end loop;
end $$;

do $$
declare
  r record;
  fk_cols text;
  ref_cols text;
  on_update text;
  match_clause text;
  def_clause text;
  valid_clause text;
begin
  for r in
    select
      con.oid,
      con.conname,
      ns.nspname as schema_name,
      rel.relname as table_name,
      con.conrelid,
      con.confrelid,
      con.conkey,
      con.confkey,
      con.confupdtype,
      con.confdeltype,
      con.confmatchtype,
      con.condeferrable,
      con.condeferred,
      con.convalidated
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where con.contype = 'f'
      and ns.nspname = 'public'
      and con.confrelid = 'public.empresas'::regclass
  loop
    if r.confdeltype = 'r' then
      continue;
    end if;

    select string_agg(format('%I', a.attname), ', ' order by u.ord)
    into fk_cols
    from unnest(r.conkey) with ordinality as u(attnum, ord)
    join pg_attribute a on a.attrelid = r.conrelid and a.attnum = u.attnum;

    select string_agg(format('%I', a.attname), ', ' order by u.ord)
    into ref_cols
    from unnest(r.confkey) with ordinality as u(attnum, ord)
    join pg_attribute a on a.attrelid = r.confrelid and a.attnum = u.attnum;

    on_update := case r.confupdtype
      when 'a' then 'no action'
      when 'r' then 'restrict'
      when 'c' then 'cascade'
      when 'n' then 'set null'
      when 'd' then 'set default'
      else 'no action'
    end;

    match_clause := case r.confmatchtype
      when 'f' then ' match full'
      when 'p' then ' match partial'
      else ''
    end;

    def_clause :=
      case when r.condeferrable then ' deferrable' else '' end ||
      case when r.condeferred then ' initially deferred' else '' end;

    valid_clause := case when not r.convalidated then ' not valid' else '' end;

    execute format('alter table %I.%I drop constraint %I', r.schema_name, r.table_name, r.conname);
    execute format(
      'alter table %I.%I add constraint %I foreign key (%s) references public.empresas(%s)%s on update %s on delete restrict%s%s',
      r.schema_name,
      r.table_name,
      r.conname,
      fk_cols,
      ref_cols,
      match_clause,
      on_update,
      def_clause,
      valid_clause
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
