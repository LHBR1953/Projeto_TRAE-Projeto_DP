BEGIN;

ALTER TABLE public.usuario_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_cancelados ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.usuario_empresas ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.usuario_empresas ADD COLUMN IF NOT EXISTS user_email TEXT;

CREATE OR REPLACE FUNCTION public.is_member_of_empresa(target_empresa_id text)
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
  );
$$;

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

GRANT EXECUTE ON FUNCTION public.is_member_of_empresa(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_empresa(text) TO authenticated;

DROP POLICY IF EXISTS "Users can view their own tenant mappings" ON public.usuario_empresas;
CREATE POLICY "Users can view their own tenant mappings"
ON public.usuario_empresas
FOR SELECT
USING (auth.uid()::text = usuario_id::text);

DROP POLICY IF EXISTS "Admins can view all users in their company" ON public.usuario_empresas;
CREATE POLICY "Admins can view all users in their company"
ON public.usuario_empresas
FOR SELECT
USING (
  public.is_admin_of_empresa(usuario_empresas.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

DROP POLICY IF EXISTS "Admins can manage users in their company" ON public.usuario_empresas;
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

DROP POLICY IF EXISTS "Users can view transactions of their company" ON public.financeiro_transacoes;
CREATE POLICY "Users can view transactions of their company"
ON public.financeiro_transacoes
FOR SELECT
USING (
  public.is_member_of_empresa(financeiro_transacoes.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

DROP POLICY IF EXISTS "Users can insert transactions in their company" ON public.financeiro_transacoes;
CREATE POLICY "Users can insert transactions in their company"
ON public.financeiro_transacoes
FOR INSERT
WITH CHECK (
  public.is_member_of_empresa(financeiro_transacoes.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

DROP POLICY IF EXISTS "Admins can update transactions in their company" ON public.financeiro_transacoes;
CREATE POLICY "Admins can update transactions in their company"
ON public.financeiro_transacoes
FOR UPDATE
USING (
  public.is_admin_of_empresa(financeiro_transacoes.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
)
WITH CHECK (
  public.is_admin_of_empresa(financeiro_transacoes.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

DROP POLICY IF EXISTS "Admins can delete transactions in their company" ON public.financeiro_transacoes;
CREATE POLICY "Admins can delete transactions in their company"
ON public.financeiro_transacoes
FOR DELETE
USING (
  public.is_admin_of_empresa(financeiro_transacoes.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

DROP POLICY IF EXISTS "Admins can view cancel logs of their company" ON public.orcamento_cancelados;
CREATE POLICY "Admins can view cancel logs of their company"
ON public.orcamento_cancelados
FOR SELECT
USING (
  public.is_admin_of_empresa(orcamento_cancelados.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

DROP POLICY IF EXISTS "Users can insert cancel logs in their company" ON public.orcamento_cancelados;
CREATE POLICY "Users can insert cancel logs in their company"
ON public.orcamento_cancelados
FOR INSERT
WITH CHECK (
  public.is_member_of_empresa(orcamento_cancelados.empresa_id)
  OR COALESCE(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

COMMIT;
