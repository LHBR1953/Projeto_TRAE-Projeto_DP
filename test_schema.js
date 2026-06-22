const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function checkSchema() {
    const { data: subs, error: err2 } = await db.from('especialidade_subdivisoes_template').select('*').limit(5);
    console.log(subs);
}
checkSchema();