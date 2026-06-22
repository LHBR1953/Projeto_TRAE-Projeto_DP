const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function checkSchema() {
    const { data: specs, error: err1 } = await db.from('especialidades_template').select('*').limit(2);
    console.log(specs);
}
checkSchema();