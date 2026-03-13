const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function fix() {
    const sql = `
    -- 1. Remover a constraint atual que não é CASCADE
    ALTER TABLE public.financeiro_comissoes 
    DROP CONSTRAINT IF EXISTS financeiro_comissoes_item_id_fkey;

    -- 2. Recriar a constraint com ON DELETE CASCADE
    ALTER TABLE public.financeiro_comissoes 
    ADD CONSTRAINT financeiro_comissoes_item_id_fkey 
    FOREIGN KEY (item_id) 
    REFERENCES public.orcamento_itens(id) 
    ON DELETE CASCADE;
    `;

    console.log("Tentando executar o SQL para corrigir a constraint...");
    // Since we don't have a direct 'exec_sql' RPC in most standard setups, 
    // we'll advise the user to run this in the SQL editor if this fails.
    const { error } = await db.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error("Erro via RPC (provavelmente função não permitida):", error.message);
        console.log("\nINSTRUÇÕES PARA O USUÁRIO:");
        console.log("Copie e cole o SQL abaixo no seu painel do Supabase (SQL Editor):");
        console.log("------------------------------------------------------------");
        console.log(sql);
        console.log("------------------------------------------------------------");
    } else {
        console.log("Sucesso! A constraint foi corrigida para CASCADE.");
    }
}

fix();
