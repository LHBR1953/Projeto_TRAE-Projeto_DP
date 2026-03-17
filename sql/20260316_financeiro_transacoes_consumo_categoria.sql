begin;

select
  empresa_id,
  categoria,
  tipo,
  count(*) as qtd,
  sum(valor) as total
from public.financeiro_transacoes
where categoria in ('PAGAMENTO', 'CONSUMO')
group by empresa_id, categoria, tipo
order by empresa_id, categoria, tipo;

update public.financeiro_transacoes
set categoria = 'CONSUMO'
where tipo = 'DEBITO'
  and categoria = 'PAGAMENTO'
  and (
    observacoes ilike '[Consumo] %'
    or observacoes ilike '%[Consumo]%'
  );

select
  empresa_id,
  categoria,
  tipo,
  count(*) as qtd,
  sum(valor) as total
from public.financeiro_transacoes
where categoria in ('PAGAMENTO', 'CONSUMO')
group by empresa_id, categoria, tipo
order by empresa_id, categoria, tipo;

commit;
