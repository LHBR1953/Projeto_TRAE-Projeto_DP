BEGIN;

-- 1. Atualizar config_planos (adicionar 'Central do Paciente' se não existir)
UPDATE public.config_planos
SET modulos_texto = modulos_texto || ', Central do Paciente'
WHERE modulos_texto IS NOT NULL 
  AND modulos_texto NOT ILIKE '%Central do Paciente%';

-- 2. Atualizar empresas (modulos_contratados)
UPDATE public.empresas
SET modulos_contratados = modulos_contratados || ', Central do Paciente'
WHERE modulos_contratados IS NOT NULL 
  AND modulos_contratados NOT ILIKE '%Central do Paciente%';

-- 3. Injetar a permissão 'chat_pacientes' para os administradores (backfill)
UPDATE public.usuario_empresas
SET permissoes = jsonb_set(
    COALESCE(permissoes, '{}'::jsonb),
    '{chat_pacientes}',
    '{"select": true, "insert": true, "update": true, "delete": true}'::jsonb,
    true
)
WHERE lower(coalesce(perfil, '')) in ('admin','admim','administrador','administrator')
  AND NOT (COALESCE(permissoes, '{}'::jsonb) ? 'chat_pacientes');

-- 4. Injetar a permissão 'chat_pacientes' para os administradores na tabela legada (empresa_usuarios), se existir
DO $$
BEGIN
  IF to_regclass('public.empresa_usuarios') IS NOT NULL THEN
    UPDATE public.empresa_usuarios
    SET permissoes = jsonb_set(
        COALESCE(permissoes, '{}'::jsonb),
        '{chat_pacientes}',
        '{"select": true, "insert": true, "update": true, "delete": true}'::jsonb,
        true
    )
    WHERE lower(coalesce(perfil, '')) in ('admin','admim','administrador','administrator')
      AND NOT (COALESCE(permissoes, '{}'::jsonb) ? 'chat_pacientes');
  END IF;
END $$;

-- 5. Caso o usuário possua uma tabela customizada de módulos (modulos ou sys_modulos)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sys_modulos') THEN
        EXECUTE 'INSERT INTO public.sys_modulos (id, label) VALUES (''chat_pacientes'', ''Central do Paciente'') ON CONFLICT DO NOTHING;';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modulos') THEN
        EXECUTE 'INSERT INTO public.modulos (id, nome) VALUES (''chat_pacientes'', ''Central do Paciente'') ON CONFLICT DO NOTHING;';
    END IF;
END $$;

COMMIT;
