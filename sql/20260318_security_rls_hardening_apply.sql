begin;

create or replace function public.occ_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
$$;

grant execute on function public.occ_is_super_admin() to authenticated;

create or replace function public.is_member_of_empresa(target_empresa_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id::text = auth.uid()::text
      and ue.empresa_id = target_empresa_id
  )
$$;

create or replace function public.is_admin_of_empresa(target_empresa_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id::text = auth.uid()::text
      and ue.empresa_id = target_empresa_id
      and ue.perfil = 'admin'
  )
$$;

grant execute on function public.is_member_of_empresa(text) to authenticated;
grant execute on function public.is_admin_of_empresa(text) to authenticated;

create or replace function public.occ_perm_true(v text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when v is null then false
    when lower(trim(v)) in ('true','t','1','yes','sim','s','on') then true
    else false
  end
$$;

grant execute on function public.occ_perm_true(text) to authenticated;

create or replace function public.occ_has_perm(target_empresa_id text, module_key text, action_key text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    public.occ_perm_true(
      (
        select ue.permissoes -> module_key ->> action_key
        from public.usuario_empresas ue
        where ue.usuario_id::text = auth.uid()::text
          and ue.empresa_id = target_empresa_id
        limit 1
      )
    ),
    false
  )
$$;

grant execute on function public.occ_has_perm(text, text, text) to authenticated;

create or replace function public.occ_ensure_policy(
  p_table text,
  p_policy text,
  p_cmd text,
  p_using text,
  p_check text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if to_regclass('public.' || p_table) is null then
    return;
  end if;

  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = p_table
      and p.policyname = p_policy
      and p.cmd = lower(p_cmd)
  ) then
    return;
  end if;

  if lower(p_cmd) = 'insert' then
    execute format(
      'create policy %I on public.%I for INSERT to authenticated with check (%s)',
      p_policy, p_table, coalesce(p_check, p_using)
    );
  elsif lower(p_cmd) = 'update' then
    if p_check is null then
      execute format(
        'create policy %I on public.%I for UPDATE to authenticated using (%s)',
        p_policy, p_table, p_using
      );
    else
      execute format(
        'create policy %I on public.%I for UPDATE to authenticated using (%s) with check (%s)',
        p_policy, p_table, p_using, p_check
      );
    end if;
  else
    execute format(
      'create policy %I on public.%I for %s to authenticated using (%s)',
      p_policy, p_table, upper(p_cmd), p_using
    );
  end if;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'pacientes','profissionais','especialidades','especialidade_subdivisoes','servicos',
    'orcamentos','orcamento_itens','orcamento_pagamentos',
    'agenda_disponibilidade','agenda_agendamentos',
    'financeiro_transacoes','financeiro_comissoes',
    'orcamento_cancelados',
    'paciente_evolucao','paciente_documentos',
    'laboratorios_proteticos','ordens_proteticas','ordens_proteticas_eventos','ordens_proteticas_anexos'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

select public.occ_ensure_policy('pacientes','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('pacientes','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('pacientes','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''pacientes'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('pacientes','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''pacientes'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('profissionais','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('profissionais','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('profissionais','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''profissionais'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('profissionais','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''profissionais'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('especialidades','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('especialidades','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('especialidades','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''especialidades'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('especialidades','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''especialidades'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('especialidade_subdivisoes','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('especialidade_subdivisoes','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('especialidade_subdivisoes','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''especialidades'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('especialidade_subdivisoes','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''especialidades'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('servicos','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('servicos','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('servicos','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''servicos'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('servicos','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''servicos'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('orcamentos','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('orcamentos','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('orcamentos','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''orcamentos'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('orcamentos','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''orcamentos'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('orcamento_itens','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('orcamento_itens','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('orcamento_itens','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''orcamentos'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('orcamento_itens','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''orcamentos'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('orcamento_pagamentos','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('orcamento_pagamentos','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('orcamento_pagamentos','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''orcamentos'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('orcamento_pagamentos','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''orcamentos'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('agenda_disponibilidade','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('agenda_disponibilidade','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('agenda_disponibilidade','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''agenda'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('agenda_disponibilidade','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''agenda'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('agenda_agendamentos','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('agenda_agendamentos','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('agenda_agendamentos','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''agenda'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('agenda_agendamentos','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''agenda'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('financeiro_transacoes','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('financeiro_transacoes','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('financeiro_transacoes','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''financeiro'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('financeiro_transacoes','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''financeiro'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('financeiro_comissoes','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('financeiro_comissoes','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('financeiro_comissoes','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''comissoes'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('financeiro_comissoes','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''comissoes'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('orcamento_cancelados','occ_v1_select','select','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('orcamento_cancelados','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');

select public.occ_ensure_policy('paciente_evolucao','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('paciente_evolucao','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('paciente_evolucao','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''pacientes'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('paciente_evolucao','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''pacientes'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('paciente_documentos','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('paciente_documentos','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('paciente_documentos','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''pacientes'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('paciente_documentos','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''pacientes'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('laboratorios_proteticos','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('laboratorios_proteticos','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('laboratorios_proteticos','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''protese'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('laboratorios_proteticos','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''protese'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('ordens_proteticas','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('ordens_proteticas','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('ordens_proteticas','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''protese'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('ordens_proteticas','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''protese'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('ordens_proteticas_eventos','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('ordens_proteticas_eventos','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('ordens_proteticas_eventos','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''protese'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('ordens_proteticas_eventos','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''protese'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('ordens_proteticas_anexos','occ_v1_select','select','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('ordens_proteticas_anexos','occ_v1_insert','insert','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('ordens_proteticas_anexos','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''protese'',''update'') or public.occ_is_super_admin()','public.is_member_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('ordens_proteticas_anexos','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''protese'',''delete'') or public.occ_is_super_admin()', null);

commit;
