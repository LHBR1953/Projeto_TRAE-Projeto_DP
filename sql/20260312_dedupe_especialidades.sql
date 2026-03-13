BEGIN;

-- Remove lixo sem empresa_id (causado por inserções com contexto de empresa indefinido)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'especialidade_subdivisoes'
      AND column_name = 'empresa_id'
  ) THEN
    EXECUTE 'DELETE FROM public.especialidade_subdivisoes WHERE empresa_id IS NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'especialidades'
      AND column_name = 'empresa_id'
  ) THEN
    EXECUTE 'DELETE FROM public.especialidades WHERE empresa_id IS NULL';
  END IF;
END $$;

-- Deduplicar por (empresa_id, nome) mantendo o menor seqid (e depois menor id)
WITH ranked AS (
  SELECT
    e.id,
    e.empresa_id,
    e.nome,
    e.seqid,
    row_number() OVER (
      PARTITION BY e.empresa_id, upper(trim(e.nome))
      ORDER BY (CASE WHEN e.seqid IS NULL THEN 2147483647 ELSE e.seqid END), e.id
    ) AS rn,
    first_value(e.id) OVER (
      PARTITION BY e.empresa_id, upper(trim(e.nome))
      ORDER BY (CASE WHEN e.seqid IS NULL THEN 2147483647 ELSE e.seqid END), e.id
    ) AS keep_id
  FROM public.especialidades e
  WHERE e.empresa_id IS NOT NULL
)
UPDATE public.especialidade_subdivisoes s
SET especialidade_id = r.keep_id
FROM ranked r
WHERE r.rn > 1
  AND s.especialidade_id = r.id;

-- Atualiza referências em profissionais, se existir a coluna especialidadeid
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profissionais'
      AND column_name = 'especialidadeid'
  ) THEN
    EXECUTE $SQL$
      WITH ranked AS (
        SELECT
          e.id,
          e.empresa_id,
          e.nome,
          e.seqid,
          row_number() OVER (
            PARTITION BY e.empresa_id, upper(trim(e.nome))
            ORDER BY (CASE WHEN e.seqid IS NULL THEN 2147483647 ELSE e.seqid END), e.id
          ) AS rn,
          first_value(e.id) OVER (
            PARTITION BY e.empresa_id, upper(trim(e.nome))
            ORDER BY (CASE WHEN e.seqid IS NULL THEN 2147483647 ELSE e.seqid END), e.id
          ) AS keep_id
        FROM public.especialidades e
        WHERE e.empresa_id IS NOT NULL
      )
      UPDATE public.profissionais p
      SET especialidadeid = r.keep_id
      FROM ranked r
      WHERE r.rn > 1
        AND p.especialidadeid = r.id;
    $SQL$;
  END IF;
END $$;

WITH ranked AS (
  SELECT
    e.id,
    e.empresa_id,
    e.nome,
    e.seqid,
    row_number() OVER (
      PARTITION BY e.empresa_id, upper(trim(e.nome))
      ORDER BY (CASE WHEN e.seqid IS NULL THEN 2147483647 ELSE e.seqid END), e.id
    ) AS rn
  FROM public.especialidades e
  WHERE e.empresa_id IS NOT NULL
)
DELETE FROM public.especialidades e
USING ranked r
WHERE e.id = r.id
  AND r.rn > 1;

-- Opcional (recomendado): criar índice único para impedir duplicação futura.
-- Descomente se quiser travar duplicidade por nome dentro da mesma empresa.
-- CREATE UNIQUE INDEX IF NOT EXISTS especialidades_empresa_nome_uq
-- ON public.especialidades (empresa_id, upper(trim(nome)));

COMMIT;
