begin;

create table if not exists public.auditoria_log (
  id uuid primary key default uuid_generate_v4(),
  empresa_id text not null,
  usuario_id uuid not null,
  data_hora timestamptz not null default now(),
  valor_antigo jsonb,
  valor_novo jsonb
);

alter table public.auditoria_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='auditoria_log' and policyname='auditoria_log_insert_empresa') then
    create policy auditoria_log_insert_empresa
    on public.auditoria_log
    for insert
    to authenticated
    with check (
      exists (
        select 1
        from public.usuario_empresas ue
        where ue.usuario_id = auth.uid()
          and ue.empresa_id = auditoria_log.empresa_id
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='auditoria_log' and policyname='auditoria_log_select_admin') then
    create policy auditoria_log_select_admin
    on public.auditoria_log
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.usuario_empresas ue
        where ue.usuario_id = auth.uid()
          and ue.empresa_id = auditoria_log.empresa_id
          and lower(coalesce(ue.perfil,'')) ~ '(adm|admin|administrador|administrator)'
      )
    );
  end if;
end $$;

create or replace function public.occ_is_role_admin(role_text text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(role_text,'')) ~ '(adm|admin|administrador|administrator)';
$$;

create or replace function public.occ_is_role_dentist(role_text text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(role_text,'')) ~ '(dentista|especialista)';
$$;

create or replace function public.occ_budget_has_payment(p_empresa_id text, p_budget_id text, p_budget_seqid bigint)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.orcamento_pagamentos p
    where p.empresa_id = p_empresa_id
      and (
        p.orcamento_id::text = p_budget_id::text
        or p.orcamento_id::text = p_budget_seqid::text
      )
  );
$$;

create or replace function public.occ_budget_is_editable_for_dentist(p_empresa_id text, p_status text, p_created_at timestamptz, p_budget_id text, p_budget_seqid bigint)
returns boolean
language sql
stable
as $$
  select
    lower(coalesce(p_status,'')) = 'pendente'
    and p_created_at is not null
    and now() - p_created_at <= interval '4 hours'
    and not public.occ_budget_has_payment(p_empresa_id, p_budget_id, p_budget_seqid);
$$;

create or replace function public.trg_orcamentos_guard_dentist()
returns trigger
language plpgsql
as $$
declare
  role_txt text;
  allowed boolean;
begin
  role_txt := (
    select ue.perfil
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = old.empresa_id
    limit 1
  );

  if public.occ_is_role_dentist(role_txt) then
    allowed := public.occ_budget_is_editable_for_dentist(old.empresa_id, old.status, old.created_at, old.id, old.seqid::bigint);
    if not allowed then
      raise exception 'Orçamento travado para Dentista: fora da janela de 4h, aprovado, ou com pagamento vinculado.';
    end if;
    if tg_op = 'UPDATE' and lower(coalesce(new.status,'')) <> 'pendente' then
      raise exception 'Orçamento travado para Dentista: não é permitido alterar status para %.', new.status;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists orcamentos_guard_dentist on public.orcamentos;
create trigger orcamentos_guard_dentist
before update or delete on public.orcamentos
for each row execute function public.trg_orcamentos_guard_dentist();

create or replace function public.trg_orcamentos_audit_locked_admin()
returns trigger
language plpgsql
as $$
declare
  role_txt text;
  editable_for_dentist boolean;
begin
  role_txt := (
    select ue.perfil
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = old.empresa_id
    limit 1
  );

  if public.occ_is_role_admin(role_txt) then
    editable_for_dentist := public.occ_budget_is_editable_for_dentist(old.empresa_id, old.status, old.created_at, old.id, old.seqid::bigint);
    if not editable_for_dentist then
      insert into public.auditoria_log (empresa_id, usuario_id, data_hora, valor_antigo, valor_novo)
      values (old.empresa_id, auth.uid(), now(), to_jsonb(old), to_jsonb(new));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orcamentos_audit_locked_admin on public.orcamentos;
create trigger orcamentos_audit_locked_admin
before update on public.orcamentos
for each row execute function public.trg_orcamentos_audit_locked_admin();

create or replace function public.trg_orcamento_itens_guard_dentist()
returns trigger
language plpgsql
as $$
declare
  role_txt text;
  b public.orcamentos%rowtype;
  allowed boolean;
  budget_id text;
begin
  role_txt := (
    select ue.perfil
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = coalesce(old.empresa_id, new.empresa_id)
    limit 1
  );

  if not public.occ_is_role_dentist(role_txt) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  budget_id := coalesce(old.orcamento_id, new.orcamento_id);
  select * into b from public.orcamentos where id = budget_id limit 1;
  if b.id is null then
    raise exception 'Orçamento não encontrado para o item.';
  end if;

  allowed := public.occ_budget_is_editable_for_dentist(b.empresa_id, b.status, b.created_at, b.id, b.seqid::bigint);
  if not allowed then
    raise exception 'Orçamento travado para Dentista: não é permitido alterar itens.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists orcamento_itens_guard_dentist on public.orcamento_itens;
create trigger orcamento_itens_guard_dentist
before insert or update or delete on public.orcamento_itens
for each row execute function public.trg_orcamento_itens_guard_dentist();

create or replace function public.trg_orcamento_itens_audit_locked_admin()
returns trigger
language plpgsql
as $$
declare
  role_txt text;
  b public.orcamentos%rowtype;
  editable_for_dentist boolean;
  budget_id text;
begin
  role_txt := (
    select ue.perfil
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = coalesce(old.empresa_id, new.empresa_id)
    limit 1
  );

  if not public.occ_is_role_admin(role_txt) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  budget_id := coalesce(old.orcamento_id, new.orcamento_id);
  select * into b from public.orcamentos where id = budget_id limit 1;
  if b.id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  editable_for_dentist := public.occ_budget_is_editable_for_dentist(b.empresa_id, b.status, b.created_at, b.id, b.seqid::bigint);
  if not editable_for_dentist then
    insert into public.auditoria_log (empresa_id, usuario_id, data_hora, valor_antigo, valor_novo)
    values (b.empresa_id, auth.uid(), now(), to_jsonb(old), to_jsonb(new));
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists orcamento_itens_audit_locked_admin on public.orcamento_itens;
create trigger orcamento_itens_audit_locked_admin
before update on public.orcamento_itens
for each row execute function public.trg_orcamento_itens_audit_locked_admin();

notify pgrst, 'reload schema';

commit;

