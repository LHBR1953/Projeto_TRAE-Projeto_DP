const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Listing all tables in public schema...");
    // Use an RPC if available to query pg_catalog or just try to select from likely tables
    const tablesToTry = ['orcamentos', 'orcamento', 'pacientes', 'profissionais'];

    for (const table of tablesToTry) {
        const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (error) {
            console.log(`Table '${table}' check: ERROR - ${error.message}`);
        } else {
            console.log(`Table '${table}' check: EXISTS`);
        }
    }
}

run();
