const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking columns for orcamento_pagamentos...");
    const { data, error } = await supabase.from('orcamento_pagamentos').select('*').limit(1);

    if (error) {
        console.error("Error fetching orcamento_pagamentos:", error);
    } else if (data && data.length > 0) {
        console.log("Sample data:", data[0]);
    } else {
        console.log("No data found in orcamento_pagamentos, checking schema via another way...");
    }

    console.log("Checking columns for financeiro_transacoes...");
    const { data: data2, error: error2 } = await supabase.from('financeiro_transacoes').select('*').limit(1);
    if (error2) console.error("Error fetching financeiro_transacoes:", error2);
    else if (data2 && data2.length > 0) console.log("Sample data:", data2[0]);
}

run();
