const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking columns for orcamentos...");
    const { data, error } = await supabase.from('orcamentos').select('*').limit(1);
    if (error) {
        console.error("Error fetching orcamentos:", error);
    } else if (data && data.length > 0) {
        console.log("Sample orcamentos data:", data[0]);
    } else {
        console.log("orcamentos is empty.");
    }

    console.log("Checking columns for orcamento...");
    const { data: data2, error: error2 } = await supabase.from('orcamento').select('*').limit(1);
    if (error2) {
        console.error("Error fetching orcamento:", error2);
    } else if (data2 && data2.length > 0) {
        console.log("Sample orcamento data:", data2[0]);
    } else {
        console.log("orcamento is empty.");
    }
}

run();
