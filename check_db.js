const { createClient } = require('C:/Projeto_TRAE/Projeto_DP/node_modules/@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function run() {
    console.log("Checking DB...");
    // 1. Get budget 18
    const { data: budget, error: bErr } = await db.from('orcamentos').select('*').eq('seqid', 18).single();
    if (bErr) { console.error("Budget err:", bErr); return; }
    console.log("Budget:", budget.id, budget.status);

    // 2. Get items
    const { data: items, error: iErr } = await db.from('orcamento_itens').select('*').eq('orcamento_id', budget.id);
    if (iErr) { console.error("Items err:", iErr); return; }
    console.log("Items:");
    items.forEach(i => console.log(` - ID: ${i.id}, Status: ${i.status}, Prof: ${i.profissional_id}`));

    // 3. Get commissions
    const itemIds = items.map(i => i.id);
    const { data: comms, error: cErr } = await db.from('financeiro_comissoes').select('*').in('item_id', itemIds);
    if (cErr) { console.error("Comms err:", cErr); return; }
    console.log("Commissions:");
    comms.forEach(c => console.log(` - ID: ${c.id}, Item: ${c.item_id}, Valor: ${c.valor_comissao}, Prof: ${c.profissional_id}`));
}

run();