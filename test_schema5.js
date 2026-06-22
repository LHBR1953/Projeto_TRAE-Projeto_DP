const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function checkSchema() {
    const { data: specs, error: err1 } = await db.from('especialidades_template').select('*').limit(1);
    if (err1) console.error("Specs err:", err1);
    else console.log("Specs:", specs);

    const { data: subs, error: err2 } = await db.from('especialidade_subdivisoes_template').select('*').limit(1);
    if (err2) console.error("Subs err:", err2);
    else console.log("Subs:", subs);
}
checkSchema();