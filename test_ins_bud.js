const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function testBudgetInsert() {
    const budgetData = {
        id: Date.now().toString(36),
        seqid: 999,
        pacienteid: 'mmc9f79ukyf3di1sc',
        pacientenome: 'Test Name',
        pacientecelular: '1234',
        pacienteemail: 'a@a',
        status: 'Pendente',
        itens: [{ servicoId: '123', valor: 50.0 }]
    };

    console.log("Inserting:", budgetData);

    const { data, error } = await db.from('orcamentos').insert(budgetData).select().single();
    if (error) {
        console.error("INSERT ERROR:", error);
    } else {
        console.log("INSERT SUCCESS, DATA:", JSON.stringify(data, null, 2));
        await db.from('orcamentos').delete().eq('id', budgetData.id);
    }
}
testBudgetInsert();
