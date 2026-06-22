const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function test() {
    const { data, error } = await db.from('especialidade_subdivisoes_template').select('id,nome,especialidade_id');
    console.log("error:", error);
}
test();