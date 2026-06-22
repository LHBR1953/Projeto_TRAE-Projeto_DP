const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function testMap() {
    const { data: specs } = await db.from('especialidades_template').select('*');
    const { data: subs } = await db.from('especialidade_subdivisoes_template').select('*');

    specs.forEach(spec => {
        const sSeq = String(spec && spec.seqid || '').trim();
        spec.subdivisoes = subs.filter(sub => String(sub && sub.especialidade_seqid || '').trim() === sSeq);
    });

    console.log("Specs count:", specs.length);
    console.log("Specs with subdivisions:");
    specs.forEach(s => {
        if (s.subdivisoes.length > 0) {
            console.log(s.nome, "has", s.subdivisoes.length, "subdivisions");
        }
    });
}
testMap();