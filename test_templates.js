const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function checkTemplates() {
    const { data: specs, error: err1 } = await db.from('especialidades_template').select('*');
    if (err1) console.error("Err1:", err1);
    else console.log("Especialidades Template Count:", specs.length);

    const { data: subs, error: err2 } = await db.from('especialidade_subdivisoes_template').select('*');
    if (err2) console.error("Err2:", err2);
    else {
        console.log("Subdivisoes Template Count:", subs.length);
        if (subs.length > 0) {
            console.log("Sample:", subs[0]);
        }
    }
}
checkTemplates();