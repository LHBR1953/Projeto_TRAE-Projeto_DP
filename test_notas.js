const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const db = createClient(supabaseUrl, supabaseKey);

async function checkNotas() {
    const { data, error } = await db.from('financeiro_notas').select('pdf_url').limit(10);
    console.log("financeiro_notas:", data, error);
}

checkNotas();
