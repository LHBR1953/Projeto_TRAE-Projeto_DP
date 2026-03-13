const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    const empresaId = 'emp_dp';
    console.log(`--- BUSCANDO TODOS OS ORÇAMENTOS DA EMPRESA ${empresaId} ---`);
    const { data: buds, error } = await supabase.from('orcamentos').select('id, seqid, pacienteid, pacientenome').eq('empresa_id', empresaId);

    if (error) {
        console.error("Erro:", error);
        return;
    }

    console.log(`Total de orçamentos: ${buds.length}`);
    buds.forEach(b => {
        console.log(`ID: ${b.id}, SeqID: ${b.seqid}, PacienteID: ${b.pacienteid}, Nome: ${b.pacientenome}`);
    });

    console.log("\n--- BUSCANDO PACIENTE MANOEL ---");
    const { data: pats } = await supabase.from('pacientes').select('id, seqid, nome').ilike('nome', '%Manoel%');
    console.log("Pacientes:", pats);
}

debug();
