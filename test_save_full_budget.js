const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function testSave() {
    const empresaId = 'emp_dp';
    
    // 1. Encontrar um paciente e um profissional válidos
    const { data: pats } = await db.from('pacientes').select('id, seqid, nome').eq('empresa_id', empresaId).limit(1);
    const { data: profs } = await db.from('profissionais').select('id, seqid, nome').eq('empresa_id', empresaId).limit(1);
    const { data: servs } = await db.from('servicos').select('id, seqid, descricao').eq('empresa_id', empresaId).limit(1);

    if (!pats.length || !profs.length || !servs.length) {
        console.error("Dados necessários não encontrados para o teste.");
        return;
    }

    const pat = pats[0];
    const prof = profs[0];
    const serv = servs[0];

    console.log(`Usando Paciente: ${pat.nome} (${pat.id})`);
    console.log(`Usando Profissional: ${prof.nome} (${prof.seqid})`);
    console.log(`Usando Serviço: ${serv.descricao} (${serv.id})`);

    const budgetId = 'test-' + Date.now().toString(36);
    
    const budgetData = {
        id: budgetId,
        seqid: 9999,
        pacienteid: pat.id,
        pacientenome: pat.nome,
        pacientecelular: '(00) 0000-0000',
        pacienteemail: 'teste@teste.com',
        status: 'Pendente',
        tipo: 'Normal',
        profissional_id: parseInt(prof.seqid),
        empresa_id: empresaId
    };

    console.log("Tentando inserir cabeçalho...");
    const { data: insertedBud, error: budError } = await db.from('orcamentos').insert(budgetData).select().single();

    if (budError) {
        console.error("ERRO NO CABEÇALHO:", budError);
        return;
    }
    console.log("Cabeçalho inserido com sucesso!");

    const itemsPayload = [{
        id: 'item-' + Date.now().toString(36),
        orcamento_id: insertedBud.id,
        empresa_id: empresaId,
        servico_id: serv.id,
        valor: 100,
        qtde: 1,
        protetico_id: null,
        valor_protetico: 0,
        profissional_id: parseInt(prof.seqid),
        subdivisao: 'TESTE',
        status: 'Pendente'
    }];

    console.log("Tentando inserir itens...");
    const { error: itemError } = await db.from('orcamento_itens').insert(itemsPayload);

    if (itemError) {
        console.error("ERRO NOS ITENS:", itemError);
        // Limpar o cabeçalho se os itens falharem
        await db.from('orcamentos').delete().eq('id', insertedBud.id);
    } else {
        console.log("Itens inseridos com sucesso! Limpando dados de teste...");
        await db.from('orcamento_itens').delete().eq('orcamento_id', insertedBud.id);
        await db.from('orcamentos').delete().eq('id', insertedBud.id);
        console.log("Teste concluído com SUCESSO.");
    }
}

testSave();
