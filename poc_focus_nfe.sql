-- Atualiza os dados fiscais da "Empresa Teste" para validar a PoC da Focus NFe
UPDATE public.empresas
SET config_fiscal = '{"razao_social": "Empresa Teste Ltda", "cnpj": "12345678000199", "inscricao_municipal": "987654321", "regime_tributario": "Simples Nacional", "codigo_servico": "04.01", "cep": "01001-000", "cidade": "São Paulo", "uf": "SP", "codigo_ibge_municipio": "3550308", "provedor_nfe": "FOCUS_NFE", "credenciais": {"focus_modo": "HOMOLOGACAO", "focus_token": "TOKEN_POC_TRAE_123"}}'::jsonb
WHERE id = 'emp_af6174c1b4';
