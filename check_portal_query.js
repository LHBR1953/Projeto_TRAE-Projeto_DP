const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPortalQuery() {
  const { data, error } = await supabase.from('profissionais').select('*').limit(1);
  console.log('Data:', data);
}

checkPortalQuery();