begin;

do $$
declare
  v record;
begin
  for v in
    select viewname
    from pg_views
    where schemaname = 'public'
  loop
    execute format('alter view public.%I reset (security_invoker)', v.viewname);
  end loop;
end $$;

do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like 'pg\_%' escape '\'
      and tablename not in (
        'schema_migrations',
        'supabase_migrations',
        'supabase_migrations_schema_migrations'
      )
  loop
    execute format('drop policy if exists %I on public.%I', 'Isolamento por Empresa', t.tablename);
    execute format('drop policy if exists %I on public.%I', 'Leitura Global', t.tablename);
    execute format('drop policy if exists %I on public.%I', 'Admin Global Insert', t.tablename);
    execute format('drop policy if exists %I on public.%I', 'Admin Global Update', t.tablename);
    execute format('drop policy if exists %I on public.%I', 'Admin Global Delete', t.tablename);
    execute format('alter table public.%I no force row level security', t.tablename);
    execute format('alter table public.%I disable row level security', t.tablename);
  end loop;
end $$;

commit;
