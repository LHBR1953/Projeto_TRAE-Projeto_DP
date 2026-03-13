-- Fix de contexto de empresa para um usuário (sem seletor de unidade)
-- Use quando o usuário loga, mas não enxerga Financeiro/Cancelados porque está na empresa errada.
--
-- COMO USAR:
-- 1) Troque __EMAIL__ pelo e-mail real do usuário.
-- 2) Troque __EMPRESA__ pela empresa correta (ex: emp_dp).
-- 3) Rode no Supabase SQL Editor.
--
-- Observação: este script mantém o usuário apenas na empresa escolhida.

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
SELECT u.id, '__EMPRESA__', 'admin'
FROM auth.users u
WHERE u.email = '__EMAIL__'
ON CONFLICT (usuario_id, empresa_id) DO UPDATE
SET perfil = 'admin';

DELETE FROM public.usuario_empresas ue
WHERE ue.usuario_id = (SELECT id FROM auth.users WHERE email = '__EMAIL__' LIMIT 1)
  AND ue.empresa_id <> '__EMPRESA__';

COMMIT;
