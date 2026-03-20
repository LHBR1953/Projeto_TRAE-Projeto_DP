begin;

alter table public.marketing_envios
  add column if not exists smtp_message_id text;

alter table public.marketing_envios
  add column if not exists smtp_response text;

alter table public.marketing_envios
  add column if not exists smtp_accepted jsonb;

alter table public.marketing_envios
  add column if not exists smtp_rejected jsonb;

create index if not exists marketing_envios_empresa_campanha_status_idx
  on public.marketing_envios(empresa_id, campanha_id, status);

notify pgrst, 'reload schema';

commit;

