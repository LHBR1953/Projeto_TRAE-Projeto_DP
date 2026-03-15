DO $$
BEGIN
  IF to_regclass('public.agenda_agendamentos') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'CREATE EXTENSION IF NOT EXISTS btree_gist';

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'agenda_agendamentos'
      AND c.conname = 'agenda_agendamentos_no_overlap'
  ) THEN
    EXECUTE 'ALTER TABLE public.agenda_agendamentos DROP CONSTRAINT agenda_agendamentos_no_overlap';
  END IF;

  EXECUTE $sql$
    ALTER TABLE public.agenda_agendamentos
      ADD CONSTRAINT agenda_agendamentos_no_overlap
      EXCLUDE USING gist (
        empresa_id WITH =,
        profissional_id WITH =,
        tstzrange(inicio, fim, '[)') WITH &&
      )
      WHERE (status IS DISTINCT FROM 'CANCELADO')
  $sql$;
END $$;
