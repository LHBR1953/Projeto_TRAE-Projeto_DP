const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Starting migration...");
    const queries = [
        'ALTER TABLE public.financeiro_transacoes RENAME COLUMN tenant_id TO empresa_id;',
        'ALTER TABLE public.orcamento_pagamentos RENAME COLUMN tenant_id TO empresa_id;',
        'ALTER TABLE public.financeiro_comissoes RENAME COLUMN tenant_id TO empresa_id;'
    ];

    for (const sql of queries) {
        console.log(`Executing: ${sql}`);
        // Note: Using a direct query if possible, or relying on the REST API if extensions are lucky
        // Since I don't have exec_sql RPC guaranteed, I'll try to find if there's a better way.
        // But usually, these projects have a way to run SQL.
        // Let's try to use the REST API to execute SQL if it's a Supabase project with an extension.
        // Actually, I'll just try to use the RPC 'exec_sql' which is a common helper.
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            console.error(`Error executing ${sql}:`, error);
        } else {
            console.log(`Success: ${sql}`);
        }
    }
    console.log("Migration finished.");
}

run();
