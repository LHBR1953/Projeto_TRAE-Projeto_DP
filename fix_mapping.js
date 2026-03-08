
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMapping() {
    const email = 'lhbr@lhbr.com.br';
    const companies = ['emp_padrao', 'emp_dp', 'emp_lhbr'];

    console.log(`Mapping ${email} to companies: ${companies.join(', ')}...`);

    for (const empresa_id of companies) {
        const { error } = await supabase
            .from('usuario_empresas')
            .insert([{ email, empresa_id }]);

        if (error && error.code !== '23505') { // Ignore unique constraint errors
            console.error(`Error mapping to ${empresa_id}:`, error.message);
        } else {
            console.log(`Success mapping to ${empresa_id}.`);
        }
    }
}

fixMapping();
