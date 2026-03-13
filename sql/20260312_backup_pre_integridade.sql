BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_20260312_pre_integridade;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'pacientes',
    'profissionais',
    'especialidades',
    'especialidade_subdivisoes',
    'servicos',
    'orcamentos',
    'orcamento_itens',
    'orcamento_pagamentos',
    'financeiro_transacoes',
    'financeiro_comissoes',
    'agenda_disponibilidade',
    'agenda_agendamentos',
    'orcamento_cancelados',
    'usuario_empresas',
    'paciente_evolucao',
    'paciente_documentos'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TABLE IF EXISTS backup_20260312_pre_integridade.%I', t);
      EXECUTE format('CREATE TABLE backup_20260312_pre_integridade.%I AS TABLE public.%I', t, t);
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS backup_20260312_pre_integridade.constraints_snapshot;
CREATE TABLE backup_20260312_pre_integridade.constraints_snapshot AS
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  con.conname AS constraint_name,
  contype,
  pg_get_constraintdef(con.oid, true) AS constraint_def
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'pacientes',
    'profissionais',
    'especialidades',
    'especialidade_subdivisoes',
    'servicos',
    'orcamentos',
    'orcamento_itens',
    'orcamento_pagamentos',
    'financeiro_transacoes',
    'financeiro_comissoes',
    'agenda_disponibilidade',
    'agenda_agendamentos',
    'orcamento_cancelados',
    'usuario_empresas',
    'paciente_evolucao',
    'paciente_documentos'
  );

COMMIT;
