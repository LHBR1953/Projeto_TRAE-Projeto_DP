
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Database Diagnostics ---');

    const tables = ['pacientes', 'profissionais', 'servicos', 'orcamentos', 'usuario_empresas', 'empresas'];

    for (const table of tables) {
        const { data, count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact' });

        if (error) {
            console.error(`Error checking ${table}:`, error.message);
        } else {
            console.log(`Table ${table}: ${count} records.`);
            if (data && data.length > 0) {
                const empresaIds = [...new Set(data.map(r => r.empresa_id))];
                console.log(`  Sample empresa_ids in ${table}: ${empresaIds.join(', ')}`);
                if (table === 'empresas') {
                    console.log(`  Empresas: ${data.map(e => `${e.id} (${e.nome})`).join(', ')}`);
                }
                if (table === 'usuario_empresas') {
                    console.log(`  User Mapping: ${data.map(m => `${m.email} -> ${m.empresa_id}`).join(', ')}`);
                }
            }
        }
    }
}

checkData();
