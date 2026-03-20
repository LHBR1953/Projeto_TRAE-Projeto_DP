begin;

do $$
declare
  t text;
  p text;
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
      foreach p in array array['occ_v1_select','occ_v1_insert','occ_v1_update','occ_v1_delete'] loop
        if exists (
          select 1
          from pg_policies
          where schemaname = 'public'
            and tablename = t
            and policyname = p
        ) then
          execute format('drop policy %I on public.%I', p, t);
        end if;
      end loop;
    end if;
  end loop;
end $$;

drop function if exists public.occ_ensure_policy(text, text, text, text, text);
drop function if exists public.occ_has_perm(text, text, text);
drop function if exists public.occ_perm_true(text);
drop function if exists public.is_admin_of_empresa(text);
drop function if exists public.is_member_of_empresa(text);
drop function if exists public.occ_is_super_admin();

commit;

