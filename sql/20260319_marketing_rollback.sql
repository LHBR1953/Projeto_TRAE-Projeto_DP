begin;

revoke execute on function public.rpc_marketing_fidelidade(text, integer, integer, integer, integer) from authenticated;
drop function if exists public.rpc_marketing_fidelidade(text, integer, integer, integer, integer);

revoke execute on function public.rpc_marketing_fidelidade_kpis(text) from authenticated;
drop function if exists public.rpc_marketing_fidelidade_kpis(text);

revoke execute on function public.rpc_marketing_fidelidade_count(text, integer, integer) from authenticated;
drop function if exists public.rpc_marketing_fidelidade_count(text, integer, integer);

revoke execute on function public.rpc_marketing_set_smtp_config(text, boolean, text, integer, text, text, text, text) from authenticated;
drop function if exists public.rpc_marketing_set_smtp_config(text, boolean, text, integer, text, text, text, text);

revoke execute on function public.rpc_marketing_get_smtp_config(text) from authenticated;
drop function if exists public.rpc_marketing_get_smtp_config(text);

drop table if exists public.marketing_envios;
drop table if exists public.marketing_campanhas;
drop table if exists public.marketing_smtp_config;

commit;
