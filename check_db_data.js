
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking database counts (bypassing RLS if using service role, but here we use anon so RLS applies)...');

    const tables = ['pacientes', 'profissionais', 'servicos', 'orcamentos', 'usuario_empresas'];

    for (const table of tables) {
        const { data, count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error(`Error checking ${table}:`, error.message);
        } else {
            console.log(`Table ${table}: ${count} records found.`);
        }
    }

    // Check for orphan records (missing empresa_id)
    for (const table of ['pacientes', 'profissionais', 'servicos', 'orcamentos']) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .is('empresa_id', null);

        if (!error) {
            console.log(`Table ${table} has ${count} records with NULL empresa_id.`);
        }
    }
}

checkData();
