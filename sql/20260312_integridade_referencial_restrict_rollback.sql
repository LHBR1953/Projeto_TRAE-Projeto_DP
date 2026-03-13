BEGIN;

DO $$
BEGIN
  ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_pacienteid_fkey;
  ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_profissional_id_fkey;

  ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_orcamento_id_fkey;
  ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_servico_id_fkey;
  ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_profissional_id_fkey;
  ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_protetico_id_fkey;

  ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT IF EXISTS orcamento_pagamentos_orcamento_id_fkey;

  ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_profissional_id_fkey;
  ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_item_id_fkey;
  ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_transacao_estorno_id_fkey;

  ALTER TABLE public.profissionais DROP CONSTRAINT IF EXISTS profissionais_especialidadeid_fkey;
  ALTER TABLE public.especialidade_subdivisoes DROP CONSTRAINT IF EXISTS especialidade_subdivisoes_especialidade_id_fkey;

  ALTER TABLE public.agenda_disponibilidade DROP CONSTRAINT IF EXISTS agenda_disponibilidade_profissional_id_fkey;
  ALTER TABLE public.agenda_agendamentos DROP CONSTRAINT IF EXISTS agenda_agendamentos_profissional_id_fkey;
  ALTER TABLE public.agenda_agendamentos DROP CONSTRAINT IF EXISTS agenda_agendamentos_paciente_id_fkey;

  ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_paciente_id_fkey;
  ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_paciente_destino_id_fkey;
  ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_orcamento_id_fkey;

  ALTER TABLE public.paciente_evolucao DROP CONSTRAINT IF EXISTS paciente_evolucao_paciente_id_fkey;
  ALTER TABLE public.paciente_documentos DROP CONSTRAINT IF EXISTS paciente_documentos_paciente_id_fkey;

  ALTER TABLE public.usuario_empresas DROP CONSTRAINT IF EXISTS usuario_empresas_usuario_id_fkey;
END $$;

COMMIT;
