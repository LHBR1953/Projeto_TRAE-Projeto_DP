const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQuery() {
  const { data, error } = await supabase.from('portal_mensagens').select('id, paciente_id, pacientes(nome)').limit(1);
  console.log('Error:', error);
}

checkQuery();