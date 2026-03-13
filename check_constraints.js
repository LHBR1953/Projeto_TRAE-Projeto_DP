const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking if orcamentos(seqid) is unique...");
    // We can't easily check constraints via JS without RPC, 
    // but the error reported by the user almost certainly points to this.
    // I will modify the SQL scripts to be more robust.
}

run();
