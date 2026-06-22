const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function test() {
    const { data } = await db.from('servicos_template').select('*').limit(1);
    console.log("servicos_template cols:", Object.keys(data[0] || {}));
    
    const { data: d2 } = await db.from('servicos').select('*').limit(1);
    console.log("servicos cols:", Object.keys(d2[0] || {}));
}
test();