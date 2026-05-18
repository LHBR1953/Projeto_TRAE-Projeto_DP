create or replace function public.rpc_inventory_logs_rls_diagnostico()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rls_enabled boolean := false;
  v_rls_forced boolean := false;
  v_policies json := '[]'::json;
begin
  select c.relrowsecurity, c.relforcerowsecurity
  into v_rls_enabled, v_rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'inventory_logs'
    and c.relkind = 'r';

  select coalesce(
    json_agg(
      json_build_object(
        'policyname', p.policyname,
        'cmd', p.cmd,
        'roles', p.roles,
        'qual', p.qual,
        'with_check', p.with_check
      )
      order by p.policyname
    ),
    '[]'::json
  )
  into v_policies
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'inventory_logs';

  return json_build_object(
    'ok', true,
    'table', 'public.inventory_logs',
    'rls_enabled', coalesce(v_rls_enabled, false),
    'rls_forced', coalesce(v_rls_forced, false),
    'policies', v_policies
  );
end
$$;

notify pgrst, 'reload schema';
