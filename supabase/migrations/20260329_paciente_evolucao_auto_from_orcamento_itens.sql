begin;

do $$
begin
  if to_regclass('public.paciente_evolucao') is null then
    return;
  end if;

  alter table public.paciente_evolucao add column if not exists origem text;
  alter table public.paciente_evolucao add column if not exists orcamento_id text;
  alter table public.paciente_evolucao add column if not exists orcamento_item_id text;
  alter table public.paciente_evolucao add column if not exists auto_gerado boolean not null default false;
end $$;

do $$
begin
  if to_regclass('public.paciente_evolucao') is null then
    return;
  end if;
  create unique index if not exists paciente_evolucao_empresa_orcamento_item_uq
  on public.paciente_evolucao (empresa_id, orcamento_item_id)
  where orcamento_item_id is not null;
end $$;

create or replace function public.occ_paciente_evolucao_auto_on_orcamento_item_finalizado()
returns trigger
language plpgsql
as $$
declare
  v_new_status_key text;
  v_old_status_key text;
  v_paciente_id text;
  v_servico_nome text;
  v_prof_seq bigint;
  v_prof_id text;
  v_prof_nome text;
  v_dentes_raw text;
  v_dentes_display text;
  v_desc text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  v_new_status_key := trim(lower(coalesce(new.status, '')));
  v_old_status_key := trim(lower(coalesce(old.status, '')));

  if v_new_status_key not in ('finalizado', 'concluido', 'concluído') then
    return new;
  end if;

  if v_old_status_key in ('finalizado', 'concluido', 'concluído') then
    return new;
  end if;

  if to_regclass('public.paciente_evolucao') is null then
    return new;
  end if;

  select o.pacienteid
  into v_paciente_id
  from public.orcamentos o
  where o.empresa_id = new.empresa_id
    and o.id = new.orcamento_id;

  if not found or v_paciente_id is null then
    return new;
  end if;

  v_servico_nome := null;
  if new.servico_id is not null and length(trim(new.servico_id)) > 0 then
    select s.descricao
    into v_servico_nome
    from public.servicos s
    where s.empresa_id = new.empresa_id
      and s.id = new.servico_id;
  end if;
  if v_servico_nome is null then
    v_servico_nome := coalesce(nullif(trim(coalesce(new.descricao, '')), ''), 'Procedimento');
  end if;

  v_prof_seq := null;
  v_prof_id := null;
  v_prof_nome := null;
  if new.profissional_id is not null then
    begin
      v_prof_seq := new.profissional_id::bigint;
    exception when others then
      v_prof_seq := null;
    end;
  end if;

  if v_prof_seq is not null then
    select p.id, p.nome
    into v_prof_id, v_prof_nome
    from public.profissionais p
    where p.empresa_id = new.empresa_id
      and p.seqid = v_prof_seq;
  end if;

  v_dentes_raw := nullif(trim(coalesce(new.dentes, '')), '');
  v_dentes_display := null;
  if v_dentes_raw is not null then
    v_dentes_display := replace(v_dentes_raw, ',', ' • ');
  end if;

  v_desc := '<p><strong>Procedimento:</strong> ' || v_servico_nome || '</p>';
  if v_dentes_display is not null then
    v_desc := v_desc || '<p><strong>Elementos/Dentes:</strong> ' || v_dentes_display || '</p>';
  end if;
  if v_prof_nome is not null then
    v_desc := v_desc || '<p><strong>Profissional:</strong> ' || v_prof_nome || '</p>';
  end if;
  v_desc := v_desc || '<p>Procedimento finalizado conforme orçamento.</p>';

  insert into public.paciente_evolucao (
    paciente_id,
    profissional_id,
    descricao,
    dente_regiao,
    empresa_id,
    created_by,
    origem,
    orcamento_id,
    orcamento_item_id,
    auto_gerado
  )
  select
    v_paciente_id,
    v_prof_id,
    v_desc,
    v_dentes_display,
    new.empresa_id,
    auth.uid(),
    'orcamento',
    new.orcamento_id,
    new.id,
    true
  where not exists (
    select 1
    from public.paciente_evolucao e
    where e.empresa_id = new.empresa_id
      and e.orcamento_item_id = new.id
  );

  return new;
end;
$$;

drop trigger if exists occ_trg_paciente_evolucao_auto_on_item_finalizado on public.orcamento_itens;
create trigger occ_trg_paciente_evolucao_auto_on_item_finalizado
after update of status on public.orcamento_itens
for each row
execute function public.occ_paciente_evolucao_auto_on_orcamento_item_finalizado();

create or replace function public.occ_block_paciente_evolucao_auto_mutation()
returns trigger
language plpgsql
as $$
declare
  v_role text;
begin
  v_role := coalesce(auth.jwt() ->> 'role', '');
  if v_role = 'service_role' or current_user = 'postgres' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if coalesce(old.auto_gerado, false) = true
     or trim(lower(coalesce(old.origem, ''))) = 'orcamento'
     or old.orcamento_item_id is not null then
    raise exception 'Este registro de prontuário foi gerado automaticamente a partir de um orçamento executado e não pode ser alterado por questões de segurança contábil.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.paciente_evolucao') is null then
    return;
  end if;

  drop trigger if exists occ_trg_paciente_evolucao_block_auto_upd on public.paciente_evolucao;
  create trigger occ_trg_paciente_evolucao_block_auto_upd
  before update on public.paciente_evolucao
  for each row
  execute function public.occ_block_paciente_evolucao_auto_mutation();

  drop trigger if exists occ_trg_paciente_evolucao_block_auto_del on public.paciente_evolucao;
  create trigger occ_trg_paciente_evolucao_block_auto_del
  before delete on public.paciente_evolucao
  for each row
  execute function public.occ_block_paciente_evolucao_auto_mutation();
end $$;

notify pgrst, 'reload schema';

commit;

