const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking schema for 'empresas' table...");
    // We can't see types directly easily, but we can infer from a select or try a specific query
    const { data, error } = await supabase.from('empresas').select('*').limit(1);
    if (error) {
        console.error("Error fetching empresas:", error);
    } else if (data && data.length > 0) {
        console.log("Sample empresas data:", data[0]);
        console.log("Type of id:", typeof data[0].id);
    } else {
        console.log("empresas table is empty.");
    }
}

run();
