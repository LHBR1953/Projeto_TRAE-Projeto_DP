const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('orcamento_itens').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Row:', data[0]);
    if (data[0]) {
      console.log('Columns:', Object.keys(data[0]));
    }
  }
}

checkSchema();