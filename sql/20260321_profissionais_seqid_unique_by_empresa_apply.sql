begin;

alter table public.profissionais
  drop constraint if exists profissionais_seqid_unique;

alter table public.profissionais
  drop constraint if exists profissionais_empresa_seqid_unique;

drop index if exists public.profissionais_empresa_seqid_unique;

alter table public.profissionais
  add constraint profissionais_empresa_seqid_unique unique (empresa_id, seqid);

notify pgrst, 'reload schema';

commit;
