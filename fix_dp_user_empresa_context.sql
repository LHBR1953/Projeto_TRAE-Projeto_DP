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
SELECT u.id, 'emp_dp', 'admin'
FROM auth.users u
WHERE u.email = 'dp@dp.com.br'
ON CONFLICT (usuario_id, empresa_id) DO UPDATE
SET perfil = 'admin';

DELETE FROM public.usuario_empresas ue
WHERE ue.usuario_id = (SELECT id FROM auth.users WHERE email = 'dp@dp.com.br' LIMIT 1)
  AND ue.empresa_id <> 'emp_dp';

COMMIT;
