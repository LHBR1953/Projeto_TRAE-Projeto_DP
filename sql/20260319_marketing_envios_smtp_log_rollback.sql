begin;

drop index if exists public.marketing_envios_empresa_campanha_status_idx;

alter table public.marketing_envios
  drop column if exists smtp_message_id;

alter table public.marketing_envios
  drop column if exists smtp_response;

alter table public.marketing_envios
  drop column if exists smtp_accepted;

alter table public.marketing_envios
  drop column if exists smtp_rejected;

notify pgrst, 'reload schema';

commit;

