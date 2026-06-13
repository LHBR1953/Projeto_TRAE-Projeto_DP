-- Política de segurança para permitir que a Landing Page consulte pacientes de forma anônima.
-- Esta política permite operações de SELECT (leitura) na tabela 'pacientes' para a role 'anon' (usuários não autenticados).

-- Garante que o RLS está habilitado na tabela (caso não esteja)
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Remove a política se ela já existir para evitar erros na criação
DROP POLICY IF EXISTS "Permitir leitura de pacientes pelo portal anônimo" ON public.pacientes;

-- Cria a política de leitura para a role 'anon'
CREATE POLICY "Permitir leitura de pacientes pelo portal anônimo" 
ON public.pacientes 
FOR SELECT 
TO anon 
USING (true);

-- NOTA DE SEGURANÇA: 
-- Como a tabela de pacientes contém dados sensíveis, a abordagem acima expõe a tabela para leitura.
-- Para produção, é altamente recomendável criar uma RPC (Função) que apenas valide a existência
-- do CPF/Email e retorne um booleano, ou restringir a política para expor apenas colunas não sensíveis.
