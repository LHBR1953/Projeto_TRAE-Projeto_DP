begin;

alter table public.servicos
  drop constraint if exists servicos_empresa_seqid_unique;

drop index if exists public.servicos_empresa_seqid_unique;

notify pgrst, 'reload schema';

commit;

