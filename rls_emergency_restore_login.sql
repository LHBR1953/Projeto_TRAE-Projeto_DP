BEGIN;

-- ============================================================
-- EMERGÊNCIA: RESTAURAR LOGIN
-- Motivo típico: RLS em usuario_empresas bloqueou o SELECT do mapeamento,
-- então o app não consegue descobrir empresa/perfil e faz signOut.
-- ============================================================

-- 1) Compatibilidade: se a tabela foi criada com "user_id" em vez de "usuario_id",
-- renomeia para o nome esperado pelo app (somente se "usuario_id" não existir).
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

-- 2) Se o tipo estiver como TEXT, tenta corrigir para UUID (melhora compatibilidade com auth.uid()).
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'usuario_empresas'
    AND column_name = 'usuario_id';

  IF col_type IS NOT NULL AND col_type <> 'uuid' THEN
    BEGIN
      ALTER TABLE public.usuario_empresas
      ALTER COLUMN usuario_id TYPE uuid
      USING usuario_id::uuid;
    EXCEPTION WHEN others THEN
      -- Se falhar (dados ruins), mantém como está; a policy abaixo usa cast para TEXT.
      NULL;
    END;
  END IF;
END $$;

-- 3) Garantir RLS ligado, mas com policy que SEMPRE permite o usuário ver a própria linha,
-- mesmo com diferenças de tipo (uuid/text).
ALTER TABLE public.usuario_empresas ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: remover policies que causam recursão (42P17) antes de recriar.
DROP POLICY IF EXISTS "Admins can view all users in their company" ON public.usuario_empresas;
DROP POLICY IF EXISTS "Admins can manage users in their company" ON public.usuario_empresas;
DROP POLICY IF EXISTS "Permitir leitura para admins da empresa" ON public.usuario_empresas;
DROP POLICY IF EXISTS "Permitir inserção para membros da empresa" ON public.usuario_empresas;
DROP POLICY IF EXISTS "Users can view their own tenant mappings" ON public.usuario_empresas;

CREATE POLICY "Users can view their own tenant mappings"
ON public.usuario_empresas
FOR SELECT
USING (auth.uid()::text = usuario_id::text);

-- 4) Se ainda assim você estiver travado, use a opção mais permissiva TEMPORÁRIA:
-- (descomente, execute, faça login, e depois volte aqui e reative RLS com policies corretas)
-- ALTER TABLE public.usuario_empresas DISABLE ROW LEVEL SECURITY;

COMMIT;
