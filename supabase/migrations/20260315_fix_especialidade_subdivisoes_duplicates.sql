-- Fix: evitar duplicação em especialidade_subdivisoes por (empresa, especialidade, nome)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'especialidade_subdivisoes'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY empresa_id, especialidade_id, upper(trim(nome))
          ORDER BY created_at NULLS LAST, id
        ) AS rn
      FROM public.especialidade_subdivisoes
      WHERE empresa_id IS NOT NULL
        AND especialidade_id IS NOT NULL
        AND nome IS NOT NULL
    )
    DELETE FROM public.especialidade_subdivisoes s
    USING ranked r
    WHERE s.id = r.id
      AND r.rn > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS especialidade_subdivisoes_empresa_especialidade_nome_uq
    ON public.especialidade_subdivisoes (empresa_id, especialidade_id, upper(trim(nome)));
  END IF;
END $$;
