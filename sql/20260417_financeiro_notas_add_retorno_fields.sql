alter table public.financeiro_notas
add column if not exists pdf_url text,
add column if not exists xml_retorno text,
add column if not exists mensagem_sefaz text,
add column if not exists numero_nota varchar(50),
add column if not exists chave_acesso varchar(100);
