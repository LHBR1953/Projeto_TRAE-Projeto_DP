-- DATA NORMALIZATION: Fix Empresa ID Mismatch
-- Run this in the Supabase SQL Editor to restore your data.

-- 1. Ensure the primary company ID 'emp_padrao' exists correctly
INSERT INTO public.empresas (id, nome)
VALUES ('emp_padrao', 'Minha Clínica')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 2. Migrate any data mistakenly linked to other IDs back to 'emp_padrao'
UPDATE public.pacientes SET empresa_id = 'emp_padrao' WHERE empresa_id <> 'emp_padrao';
UPDATE public.profissionais SET empresa_id = 'emp_padrao' WHERE empresa_id <> 'emp_padrao';
UPDATE public.especialidades SET empresa_id = 'emp_padrao' WHERE empresa_id <> 'emp_padrao';
UPDATE public.servicos SET empresa_id = 'emp_padrao' WHERE empresa_id <> 'emp_padrao';
UPDATE public.orcamentos SET empresa_id = 'emp_padrao' WHERE empresa_id <> 'emp_padrao';
UPDATE public.orcamento_itens SET empresa_id = 'emp_padrao' WHERE empresa_id <> 'emp_padrao';

-- 3. Update all user mappings to point to 'emp_padrao'
-- This ensures that when you log in, you are assigned to the correct company context
UPDATE public.usuario_empresas SET empresa_id = 'emp_padrao';

-- 4. Ensure your current user is an 'admin' (Total Permissions)
-- This allows you to see all menus and perform all actions
UPDATE public.usuario_empresas 
SET perfil = 'admin' 
WHERE usuario_id = (SELECT id FROM auth.users WHERE email = 'lh@lh.com.br' LIMIT 1); 

-- Note: Replace 'lh@lh.com.br' with your actual login email if different.
