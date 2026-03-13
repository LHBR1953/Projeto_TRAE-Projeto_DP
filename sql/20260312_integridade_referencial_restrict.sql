BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pacientes') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pacientes_seqid_unique') THEN
      ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_seqid_unique UNIQUE (seqid);
    END IF;
  END IF;

  IF to_regclass('public.profissionais') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profissionais_seqid_unique') THEN
      ALTER TABLE public.profissionais ADD CONSTRAINT profissionais_seqid_unique UNIQUE (seqid);
    END IF;
  END IF;

  IF to_regclass('public.orcamentos') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_seqid_unique') THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.orcamentos
        GROUP BY seqid
        HAVING COUNT(*) > 1
      ) THEN
        ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_seqid_unique UNIQUE (seqid);
      END IF;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.orcamentos') IS NOT NULL AND to_regclass('public.pacientes') IS NOT NULL THEN
    ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_pacienteid_fkey;
    ALTER TABLE public.orcamentos
      ADD CONSTRAINT orcamentos_pacienteid_fkey
      FOREIGN KEY (pacienteid) REFERENCES public.pacientes(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.orcamentos') IS NOT NULL AND to_regclass('public.profissionais') IS NOT NULL THEN
    ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_profissional_id_fkey;
    ALTER TABLE public.orcamentos
      ADD CONSTRAINT orcamentos_profissional_id_fkey
      FOREIGN KEY (profissional_id) REFERENCES public.profissionais(seqid) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.orcamento_itens') IS NOT NULL AND to_regclass('public.orcamentos') IS NOT NULL THEN
    ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_orcamento_id_fkey;
    ALTER TABLE public.orcamento_itens
      ADD CONSTRAINT orcamento_itens_orcamento_id_fkey
      FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.orcamento_itens') IS NOT NULL AND to_regclass('public.servicos') IS NOT NULL THEN
    ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_servico_id_fkey;
    ALTER TABLE public.orcamento_itens
      ADD CONSTRAINT orcamento_itens_servico_id_fkey
      FOREIGN KEY (servico_id) REFERENCES public.servicos(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.orcamento_itens') IS NOT NULL AND to_regclass('public.profissionais') IS NOT NULL THEN
    ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_profissional_id_fkey;
    ALTER TABLE public.orcamento_itens
      ADD CONSTRAINT orcamento_itens_profissional_id_fkey
      FOREIGN KEY (profissional_id) REFERENCES public.profissionais(seqid) ON DELETE RESTRICT NOT VALID;

    ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_protetico_id_fkey;
    ALTER TABLE public.orcamento_itens
      ADD CONSTRAINT orcamento_itens_protetico_id_fkey
      FOREIGN KEY (protetico_id) REFERENCES public.profissionais(seqid) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.financeiro_comissoes') IS NOT NULL AND to_regclass('public.profissionais') IS NOT NULL THEN
    ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_profissional_id_fkey;
    ALTER TABLE public.financeiro_comissoes
      ADD CONSTRAINT financeiro_comissoes_profissional_id_fkey
      FOREIGN KEY (profissional_id) REFERENCES public.profissionais(seqid) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.financeiro_comissoes') IS NOT NULL AND to_regclass('public.orcamento_itens') IS NOT NULL THEN
    ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_item_id_fkey;
    ALTER TABLE public.financeiro_comissoes
      ADD CONSTRAINT financeiro_comissoes_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES public.orcamento_itens(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profissionais') IS NOT NULL AND to_regclass('public.especialidades') IS NOT NULL THEN
    ALTER TABLE public.profissionais DROP CONSTRAINT IF EXISTS profissionais_especialidadeid_fkey;
    ALTER TABLE public.profissionais
      ADD CONSTRAINT profissionais_especialidadeid_fkey
      FOREIGN KEY (especialidadeid) REFERENCES public.especialidades(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.especialidade_subdivisoes') IS NOT NULL AND to_regclass('public.especialidades') IS NOT NULL THEN
    ALTER TABLE public.especialidade_subdivisoes DROP CONSTRAINT IF EXISTS especialidade_subdivisoes_especialidade_id_fkey;
    ALTER TABLE public.especialidade_subdivisoes
      ADD CONSTRAINT especialidade_subdivisoes_especialidade_id_fkey
      FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.agenda_disponibilidade') IS NOT NULL AND to_regclass('public.profissionais') IS NOT NULL THEN
    ALTER TABLE public.agenda_disponibilidade DROP CONSTRAINT IF EXISTS agenda_disponibilidade_profissional_id_fkey;
    ALTER TABLE public.agenda_disponibilidade
      ADD CONSTRAINT agenda_disponibilidade_profissional_id_fkey
      FOREIGN KEY (profissional_id) REFERENCES public.profissionais(seqid) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.agenda_agendamentos') IS NOT NULL AND to_regclass('public.profissionais') IS NOT NULL THEN
    ALTER TABLE public.agenda_agendamentos DROP CONSTRAINT IF EXISTS agenda_agendamentos_profissional_id_fkey;
    ALTER TABLE public.agenda_agendamentos
      ADD CONSTRAINT agenda_agendamentos_profissional_id_fkey
      FOREIGN KEY (profissional_id) REFERENCES public.profissionais(seqid) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.agenda_agendamentos') IS NOT NULL AND to_regclass('public.pacientes') IS NOT NULL THEN
    ALTER TABLE public.agenda_agendamentos DROP CONSTRAINT IF EXISTS agenda_agendamentos_paciente_id_fkey;
    ALTER TABLE public.agenda_agendamentos
      ADD CONSTRAINT agenda_agendamentos_paciente_id_fkey
      FOREIGN KEY (paciente_id) REFERENCES public.pacientes(seqid) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.financeiro_transacoes') IS NOT NULL AND to_regclass('public.pacientes') IS NOT NULL THEN
    ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_paciente_id_fkey;
    ALTER TABLE public.financeiro_transacoes
      ADD CONSTRAINT financeiro_transacoes_paciente_id_fkey
      FOREIGN KEY (paciente_id) REFERENCES public.pacientes(seqid) ON DELETE RESTRICT NOT VALID;

    ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_paciente_destino_id_fkey;
    ALTER TABLE public.financeiro_transacoes
      ADD CONSTRAINT financeiro_transacoes_paciente_destino_id_fkey
      FOREIGN KEY (paciente_destino_id) REFERENCES public.pacientes(seqid) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.financeiro_transacoes') IS NOT NULL AND to_regclass('public.orcamentos') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'financeiro_transacoes'
        AND column_name = 'orcamento_id'
    )
    AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_seqid_unique') THEN
      ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_orcamento_id_fkey;
      ALTER TABLE public.financeiro_transacoes
        ADD CONSTRAINT financeiro_transacoes_orcamento_id_fkey
        FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(seqid) ON DELETE RESTRICT NOT VALID;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.orcamento_pagamentos') IS NOT NULL AND to_regclass('public.orcamentos') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orcamento_pagamentos'
        AND column_name = 'orcamento_id'
        AND data_type IN ('bigint','integer')
    )
    AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_seqid_unique') THEN
      ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT IF EXISTS orcamento_pagamentos_orcamento_id_fkey;
      ALTER TABLE public.orcamento_pagamentos
        ADD CONSTRAINT orcamento_pagamentos_orcamento_id_fkey
        FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(seqid) ON DELETE RESTRICT NOT VALID;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.financeiro_comissoes') IS NOT NULL AND to_regclass('public.financeiro_transacoes') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'financeiro_comissoes'
        AND column_name = 'transacao_estorno_id'
    ) THEN
      ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_transacao_estorno_id_fkey;
      ALTER TABLE public.financeiro_comissoes
        ADD CONSTRAINT financeiro_comissoes_transacao_estorno_id_fkey
        FOREIGN KEY (transacao_estorno_id) REFERENCES public.financeiro_transacoes(id) ON DELETE RESTRICT NOT VALID;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.paciente_evolucao') IS NOT NULL AND to_regclass('public.pacientes') IS NOT NULL THEN
    ALTER TABLE public.paciente_evolucao DROP CONSTRAINT IF EXISTS paciente_evolucao_paciente_id_fkey;
    ALTER TABLE public.paciente_evolucao
      ADD CONSTRAINT paciente_evolucao_paciente_id_fkey
      FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.paciente_documentos') IS NOT NULL AND to_regclass('public.pacientes') IS NOT NULL THEN
    ALTER TABLE public.paciente_documentos DROP CONSTRAINT IF EXISTS paciente_documentos_paciente_id_fkey;
    ALTER TABLE public.paciente_documentos
      ADD CONSTRAINT paciente_documentos_paciente_id_fkey
      FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.usuario_empresas') IS NOT NULL THEN
    ALTER TABLE public.usuario_empresas DROP CONSTRAINT IF EXISTS usuario_empresas_usuario_id_fkey;
    ALTER TABLE public.usuario_empresas
      ADD CONSTRAINT usuario_empresas_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

COMMIT;
