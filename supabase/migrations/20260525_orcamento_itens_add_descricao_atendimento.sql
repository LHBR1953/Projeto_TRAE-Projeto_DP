begin;

alter table public.orcamento_itens
  add column if not exists descricao_atendimento text;

notify pgrst, 'reload schema';

commit;
