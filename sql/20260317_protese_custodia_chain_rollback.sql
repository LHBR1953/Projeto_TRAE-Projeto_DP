begin;

revoke execute on function public.rpc_protese_custodia_get_token(text) from anon, authenticated;
revoke execute on function public.rpc_protese_custodia_confirm(text, text, text, text, text, text) from anon, authenticated;

drop function if exists public.rpc_protese_custodia_confirm(text, text, text, text, text, text);
drop function if exists public.rpc_protese_custodia_get_token(text);

drop table if exists public.ordens_proteticas_custodia_eventos;
drop table if exists public.ordens_proteticas_custodia_tokens;

commit;

