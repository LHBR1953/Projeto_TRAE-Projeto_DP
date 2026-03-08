const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function q() {
    const { data, error } = await db.from('orcamentos').select('*').limit(2);
    console.log(JSON.stringify(data, null, 2), error);
}
q();
