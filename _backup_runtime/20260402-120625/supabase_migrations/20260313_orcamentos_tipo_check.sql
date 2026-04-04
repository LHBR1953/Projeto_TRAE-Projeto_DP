DO $$
BEGIN
  IF to_regclass('public.orcamentos') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'orcamentos'
      AND c.conname = 'orcamentos_tipo_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.orcamentos DROP CONSTRAINT orcamentos_tipo_check';
  END IF;

  EXECUTE $sql$
    ALTER TABLE public.orcamentos
    ADD CONSTRAINT orcamentos_tipo_check
    CHECK (lower(tipo) IN ('normal', 'urgencia', 'retrabalho', 'cortesia'))
  $sql$;
END $$;
