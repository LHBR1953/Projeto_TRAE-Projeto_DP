BEGIN;

-- 1. Habilitar RLS estrito nas tabelas core
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas (para evitar conflitos e buracos de segurança)
DROP POLICY IF EXISTS "Isolamento SaaS: Orçamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Isolamento SaaS: Pagamentos" ON public.orcamento_pagamentos;
DROP POLICY IF EXISTS "Isolamento SaaS: Itens" ON public.orcamento_itens;

-- Remover temporárias abertas se houver
DROP POLICY IF EXISTS "Permitir tudo provisorio orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Permitir tudo provisorio pagamentos" ON public.orcamento_pagamentos;
DROP POLICY IF EXISTS "Permitir tudo provisorio itens" ON public.orcamento_itens;

-- 3. Criar Políticas SaaS Blindadas
-- Usa replace() no JWT para remover aspas duplas espúrias que quebram o match exato
CREATE POLICY "Isolamento SaaS: Orçamentos"
ON public.orcamentos
FOR ALL
TO authenticated
USING (
  empresa_id::text = replace((auth.jwt() ->> 'empresa_id')::text, '"', '')
)
WITH CHECK (
  empresa_id::text = replace((auth.jwt() ->> 'empresa_id')::text, '"', '')
);

CREATE POLICY "Isolamento SaaS: Pagamentos"
ON public.orcamento_pagamentos
FOR ALL
TO authenticated
USING (
  empresa_id::text = replace((auth.jwt() ->> 'empresa_id')::text, '"', '')
)
WITH CHECK (
  empresa_id::text = replace((auth.jwt() ->> 'empresa_id')::text, '"', '')
);

CREATE POLICY "Isolamento SaaS: Itens"
ON public.orcamento_itens
FOR ALL
TO authenticated
USING (
  empresa_id::text = replace((auth.jwt() ->> 'empresa_id')::text, '"', '')
)
WITH CHECK (
  empresa_id::text = replace((auth.jwt() ->> 'empresa_id')::text, '"', '')
);

COMMIT;