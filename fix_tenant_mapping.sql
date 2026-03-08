-- 1. Garante que a empresa para LHBR existe
INSERT INTO public.empresas (id, nome)
VALUES ('emp_lhbr', 'LHBR Clínica')
ON CONFLICT (id) DO NOTHING;

-- 2. Atualiza os mapeamentos usando os UUIDs únicos (IDs de Usuário)
-- Isso é mais seguro e direto do que usar filtros de texto.

-- Usuário: teste@clinica.com (ID: 10621c73-15d2-4c6f-8521-d20dc8d66461)
UPDATE public.usuario_empresas
SET empresa_id = 'emp_padrao'
WHERE usuario_id = '10621c73-15d2-4c6f-8521-d20dc8d66461';

-- Usuário: lhbr@lhbr.com.br (ID: 5c1cfa02-4c3f-458f-b858-ed3ec1f63552)
UPDATE public.usuario_empresas
SET empresa_id = 'emp_lhbr'
WHERE usuario_id = '5c1cfa02-4c3f-458f-b858-ed3ec1f63552';

-- 3. Consulta de Verificação (Execute para confirmar que cada um tem sua clínica)
SELECT au.email, ue.empresa_id, e.nome as clinica
FROM public.usuario_empresas ue
JOIN auth.users au ON ue.usuario_id = au.id
JOIN public.empresas e ON ue.empresa_id = e.id
WHERE au.id IN ('10621c73-15d2-4c6f-8521-d20dc8d66461', '5c1cfa02-4c3f-458f-b858-ed3ec1f63552');
