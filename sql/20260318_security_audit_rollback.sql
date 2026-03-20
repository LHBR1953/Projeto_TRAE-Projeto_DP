begin;

do $$
declare
  t text;
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
    if exists (
      select 1
      from pg_trigger tr
      join pg_class c on c.oid = tr.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = t
        and tr.tgname = 'occ_audit_trg'
    ) then
      execute format('drop trigger occ_audit_trg on public.%I', t);
    end if;
  end loop;
end $$;

drop function if exists public.occ_audit_log_write();

do $$
begin
  if to_regclass('public.occ_audit_log') is not null then
    drop table public.occ_audit_log;
  end if;
end $$;

commit;
