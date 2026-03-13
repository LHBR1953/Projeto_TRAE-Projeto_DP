const headers = {
  apikey: "sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA",
  Authorization: "Bearer sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA",
};

const base = "https://trcktinwjpvcikidrryn.supabase.co/rest/v1";

async function get(url) {
  const res = await fetch(url, { headers });
  const txt = await res.text();
  console.log("\nURL", url);
  console.log("STATUS", res.status);
  console.log(txt);
  return { res, txt };
}

(async () => {
  await get(
    `${base}/orcamentos?select=id,seqid,empresa_id,pacientenome,status,total_pago,created_at&seqid=eq.1&limit=5`
  );
  await get(
    `${base}/orcamento_pagamentos?select=id,seqid,orcamento_id,valor_pago,data_pagamento,forma_pagamento,status_pagamento,empresa_id,criado_em,observacoes&orcamento_id=eq.1&limit=50`
  );
  await get(
    `${base}/financeiro_transacoes?select=id,seqid,paciente_id,tipo,categoria,valor,data_transacao,forma_pagamento,referencia_id,orcamento_id,paciente_destino_id,observacoes,empresa_id,criado_por&seqid=in.(34,35,36)&order=seqid.asc`
  );
  await get(
    `${base}/financeiro_transacoes?select=id,seqid,paciente_id,tipo,categoria,valor,data_transacao,forma_pagamento,referencia_id,orcamento_id,paciente_destino_id,observacoes,empresa_id,criado_por&or=(referencia_id.eq.1,orcamento_id.eq.1)&order=data_transacao.asc&limit=200`
  );
  await get(
    `${base}/financeiro_transacoes?select=id,seqid,paciente_id,tipo,categoria,valor,data_transacao,forma_pagamento,referencia_id,orcamento_id,paciente_destino_id,observacoes,empresa_id,criado_por&observacoes=ilike.*Or%C3%A7amento%20%231*&order=data_transacao.asc&limit=200`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
