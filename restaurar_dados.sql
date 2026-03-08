
-- RESTAURAR ACESSO AOS DADOS (MAPEAMENTO DE EMPRESAS)
-- Este script garante que o usuário SuperAdmin tenha acesso às empresas onde os dados estão salvos.

-- 1. Garante que as empresas básicas existem
INSERT INTO public.empresas (id, nome)
VALUES 
    ('emp_padrao', 'Minha Clínica'),
    ('emp_dp', 'Dentistas Piraquê'),
    ('emp_lhbr', 'LHBR Clínica')
ON CONFLICT (id) DO NOTHING;

-- 2. Mapeia o usuário lhbr@lhbr.com.br (ID: 5c1cfa02-4c3f-458f-b858-ed3ec1f63552)
-- como ADMIN em todas essas empresas para que o RLS permita ver os dados.
INSERT INTO public.usuario_empresas (usuario_id, empresa_id, perfil)
VALUES 
    ('5c1cfa02-4c3f-458f-b858-ed3ec1f63552', 'emp_padrao', 'admin'),
    ('5c1cfa02-4c3f-458f-b858-ed3ec1f63552', 'emp_dp', 'admin'),
    ('5c1cfa02-4c3f-458f-b858-ed3ec1f63552', 'emp_lhbr', 'admin')
ON CONFLICT (usuario_id, empresa_id) DO UPDATE SET perfil = 'admin';

-- 3. Verificação final
SELECT u.email, ue.empresa_id, e.nome as nome_clinica, ue.perfil
FROM public.usuario_empresas ue
JOIN auth.users u ON ue.usuario_id = u.id
JOIN public.empresas e ON ue.empresa_id = e.id
WHERE u.email = 'lhbr@lhbr.com.br';
