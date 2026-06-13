-- 1. Remove a policy defeituosa do Admin 
DROP POLICY IF EXISTS "Isolamento por Empresa" ON public.orcamento_pagamentos; 

-- 2. Recria a policy limpando qualquer aspa fantasma do metadado do JWT 
CREATE POLICY "Isolamento por Empresa" 
ON public.orcamento_pagamentos 
FOR ALL 
TO authenticated 
USING ( 
  empresa_id = replace((auth.jwt() -> 'user_metadata' ->> 'empresa_id'), '"', '') 
) 
WITH CHECK ( 
  empresa_id = replace((auth.jwt() -> 'user_metadata' ->> 'empresa_id'), '"', '') 
);
