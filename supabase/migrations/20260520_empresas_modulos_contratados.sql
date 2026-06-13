-- Adiciona a coluna de Snapshot de Módulos (Grandfathering) na tabela de empresas
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS modulos_contratados TEXT;

-- Backfill: Copia a configuração atual dos planos para as empresas ativas
-- Para que as empresas antigas não percam acesso ao que já tinham
UPDATE empresas e
SET modulos_contratados = cp.modulos_texto
FROM config_planos cp
WHERE (
    -- Link via UUID
    (e.plano_tipo ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND e.plano_tipo = cp.id::text)
    OR
    -- Link via nome (ilike)
    (e.plano_tipo !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND cp.tipo_assinatura ILIKE e.plano_tipo)
)
AND e.modulos_contratados IS NULL;