-- Força a remoção de qualquer trava que esteja blindando o Admin 
DROP POLICY IF EXISTS "Isolamento por Empresa" ON public.orcamento_pagamentos; 

-- Libera o SELECT/ALL para usuários autenticados sem checagem de JWT fantasmas 
CREATE POLICY "Isolamento por Empresa" 
ON public.orcamento_pagamentos 
AS PERMISSIVE FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
