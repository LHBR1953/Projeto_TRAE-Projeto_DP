-- Script para restaurar permissões nativas do PostgreSQL nas tabelas de template
-- O erro 42501 (Permission Denied) estava ocorrendo porque os privilégios de DML 
-- foram revogados diretamente na role 'authenticated' por uma migration anterior
-- (20260406_templates_readonly_shield.sql), o que bloqueia a gravação ANTES mesmo do RLS agir.

DO $$
DECLARE
  t text;
  tbls text[] := array[
    'inventory_template',
    'servicos_template',
    'usage_models_template',
    'model_items_template',
    'service_mapping_template',
    'especialidades_template',
    'especialidade_subdivisoes_template'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    -- Devolvemos os privilégios nativos para a role authenticated
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    
    -- O RLS (superadmin_all_policy) voltará a ser o único responsável pela segurança
  END LOOP;
END $$;

-- Recarrega o cache do PostgREST para reconhecer a mudança de permissão
NOTIFY pgrst, 'reload schema';