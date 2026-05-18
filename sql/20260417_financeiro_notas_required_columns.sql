alter table public.financeiro_notas
add column if not exists status_nota varchar(40),
add column if not exists pdf_url text,
add column if not exists json_envio_teste jsonb,
add column if not exists xml_retorno text,
add column if not exists mensagem_sefaz text;
