const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function test() {
    const { data, error } = await db.from('servicos').select('*').limit(1);
    console.log(JSON.stringify(data, null, 2));
}
test();