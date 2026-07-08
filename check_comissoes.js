const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');
const fs = require('fs');

async function check() {
    try {
        const { data, error } = await db
            .from('financeiro_comissoes')
            .select('*')
            .ilike('status', '%ANTECIPA%')
            .limit(5);
            
        if (error) {
            fs.writeFileSync('check_out.json', JSON.stringify({error}));
        } else {
            fs.writeFileSync('check_out.json', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        fs.writeFileSync('check_out.json', JSON.stringify({exception: e.toString()}));
    }
}
check();