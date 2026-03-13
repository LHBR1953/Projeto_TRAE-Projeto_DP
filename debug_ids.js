const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("--- BUSCANDO PACIENTE MANOEL ---");
    const { data: pats, error: err1 } = await supabase.from('pacientes').select('id, seqid, nome').ilike('nome', '%Manoel%');
    console.log("Pacientes encontrados:", pats);

    if (pats && pats.length > 0) {
        const p = pats[0];
        console.log(`\n--- BUSCANDO ORÇAMENTOS PARA ${p.nome} (seqid: ${p.seqid}, UUID: ${p.id}) ---`);

        const { data: buds, error: err2 } = await supabase.from('orcamentos')
            .select('*')
            .or(`pacienteid.eq.${p.id},paciente_id.eq.${p.seqid},pacienteseqid.eq.${p.seqid}`);

        console.log("Orçamentos encontrados por ID de paciente:", buds);
    }

    console.log("\n--- BUSCANDO ORÇAMENTO ID/SEQID 7 ---");
    const { data: b7, error: err3 } = await supabase.from('orcamentos').select('*').or(`id.eq.7,seqid.eq.7`);
    console.log("Orçamento #7 encontrado:", b7);
}

debug();
