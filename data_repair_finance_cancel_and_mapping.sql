BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuario_empresas'
      AND column_name = 'user_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuario_empresas'
      AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE public.usuario_empresas RENAME COLUMN user_id TO usuario_id;
  END IF;
END $$;

INSERT INTO public.usuario_empresas (usuario_id, empresa_id, perfil)
SELECT u.id, e.id, 'admin'
FROM auth.users u
JOIN public.empresas e ON true
WHERE u.email = 'lhbr@lhbr.com.br'
ON CONFLICT (usuario_id, empresa_id) DO UPDATE SET perfil = 'admin';

UPDATE public.financeiro_transacoes ft
SET empresa_id = p.empresa_id
FROM public.pacientes p
WHERE ft.empresa_id IS NULL
  AND p.empresa_id IS NOT NULL
  AND ft.paciente_id = p.seqid;

UPDATE public.orcamento_cancelados oc
SET empresa_id = o.empresa_id
FROM public.orcamentos o
WHERE oc.empresa_id IS NULL
  AND o.empresa_id IS NOT NULL
  AND oc.orcamento_id = o.id;

UPDATE public.orcamento_cancelados oc
SET empresa_id = p.empresa_id
FROM public.pacientes p
WHERE oc.empresa_id IS NULL
  AND p.empresa_id IS NOT NULL
  AND oc.paciente_id = p.seqid;

COMMIT;
