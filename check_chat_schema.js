const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInsert() {
  const { data, error } = await supabase.from('portal_mensagens').insert([
    { paciente_id: 'test', empresa_id: 'test', conteudo: 'test', remetente: 'paciente', lida: false }
  ]).select();
  console.log('Error:', error);
}

checkInsert();