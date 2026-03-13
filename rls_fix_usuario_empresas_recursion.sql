BEGIN;

-- ============================================================
-- FIX: ERRO 42P17 "infinite recursion detected in policy"
-- Causa: policy em usuario_empresas fazendo SELECT na própria usuario_empresas.
-- Solução: usar função SECURITY DEFINER e policies sem subquery direta.
-- ============================================================

ALTER TABLE public.usuario_empresas ENABLE ROW LEVEL SECURITY;

-- Compatibilidade: user_id -> usuario_id
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

-- Remover policies problemáticas
DROP POLICY IF EXISTS "Admins can view all users in their company" ON public.usuario_empresas;
DROP POLICY IF EXISTS "Admins can manage users in their company" ON public.usuario_empresas;
DROP POLICY IF EXISTS "Users can view their own tenant mappings" ON public.usuario_empresas;

-- Função helper (evita recursion no planner)
CREATE OR REPLACE FUNCTION public.is_admin_of_empresa(target_empresa_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_empresas ue
    WHERE ue.usuario_id::text = auth.uid()::text
      AND ue.empresa_id = target_empresa_id
      AND ue.perfil = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_of_empresa(text) TO authenticated;

-- Policies seguras
CREATE POLICY "Users can view their own tenant mappings"
ON public.usuario_empresas
FOR SELECT
USING (auth.uid()::text = usuario_id::text);

CREATE POLICY "Admins can view all users in their company"
ON public.usuario_empresas
FOR SELECT
USING (
  public.is_admin_of_empresa(usuario_empresas.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

CREATE POLICY "Admins can manage users in their company"
ON public.usuario_empresas
FOR ALL
USING (
  public.is_admin_of_empresa(usuario_empresas.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
)
WITH CHECK (
  public.is_admin_of_empresa(usuario_empresas.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

COMMIT;
