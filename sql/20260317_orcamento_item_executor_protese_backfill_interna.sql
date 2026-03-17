begin;

update public.orcamento_itens
set protese_tipo_execucao = 'INTERNA'
where protese_tipo_execucao is null;

commit;

