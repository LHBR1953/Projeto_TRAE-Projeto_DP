begin;

create table if not exists public.occ_audit_log (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  table_name text not null,
  action text not null,
  row_id text,
  old_data jsonb,
  new_data jsonb,
  actor_user_id uuid,
  actor_email text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists occ_audit_log_empresa_created_idx
on public.occ_audit_log (empresa_id, created_at desc);

alter table public.occ_audit_log enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'occ_audit_log'
      and policyname = 'occ_audit_select_admin'
      and cmd = 'select'
  ) then
    execute 'create policy occ_audit_select_admin on public.occ_audit_log
             for select to authenticated
             using (public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin())';
  end if;
end $$;

create or replace function public.occ_audit_log_write()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_empresa text;
  v_row_id text;
  v_old jsonb;
  v_new jsonb;
  v_user uuid;
  v_email text;
begin
  v_user := auth.uid();
  v_email := coalesce(auth.jwt() ->> 'email', '');

  if (tg_op = 'INSERT') then
    v_empresa := (new.empresa_id)::text;
    v_row_id := coalesce((new.id)::text, null);
    v_old := null;
    v_new := to_jsonb(new);
  elsif (tg_op = 'UPDATE') then
    v_empresa := coalesce((new.empresa_id)::text, (old.empresa_id)::text);
    v_row_id := coalesce((new.id)::text, (old.id)::text, null);
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  elsif (tg_op = 'DELETE') then
    v_empresa := (old.empresa_id)::text;
    v_row_id := coalesce((old.id)::text, null);
    v_old := to_jsonb(old);
    v_new := null;
  else
    return null;
  end if;

  insert into public.occ_audit_log (
    empresa_id,
    table_name,
    action,
    row_id,
    old_data,
    new_data,
    actor_user_id,
    actor_email
  ) values (
    v_empresa,
    tg_table_name,
    tg_op,
    v_row_id,
    v_old,
    v_new,
    v_user,
    v_email
  );

  return null;
end;
$$;

do $$
declare
  t text;
  has_empresa boolean;
begin
  foreach t in array array[
    'profissionais',
    'especialidades','especialidade_subdivisoes','servicos',
    'financeiro_transacoes','financeiro_comissoes',
    'orcamentos','orcamento_itens','orcamento_pagamentos',
    'orcamento_cancelados',
    'pacientes','paciente_evolucao','paciente_documentos',
    'agenda_disponibilidade','agenda_agendamentos',
    'usuario_empresas',
    'laboratorios_proteticos','ordens_proteticas','ordens_proteticas_eventos','ordens_proteticas_anexos'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    select exists(
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = t
        and c.column_name = 'empresa_id'
    ) into has_empresa;

    if not has_empresa then
      continue;
    end if;

    if not exists (
      select 1
      from pg_trigger tr
      join pg_class c on c.oid = tr.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = t
        and tr.tgname = 'occ_audit_trg'
    ) then
      execute format(
        'create trigger occ_audit_trg after insert or update or delete on public.%I
         for each row execute function public.occ_audit_log_write()',
        t
      );
    end if;
  end loop;
end $$;

commit;
