const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('orcamento_itens').select('id, orcamento_id, orcamento_id_novo').limit(5);
  console.log(data);
}

checkSchema();