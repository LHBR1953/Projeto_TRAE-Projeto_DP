begin;

alter table public.profissionais
  drop constraint if exists profissionais_empresa_seqid_unique;

drop index if exists public.profissionais_seqid_unique;

alter table public.profissionais
  add constraint profissionais_seqid_unique unique (seqid);

notify pgrst, 'reload schema';

commit;
