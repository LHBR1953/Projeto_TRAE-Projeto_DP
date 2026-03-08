const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');
async function test() {
    const patientData = {
        id: "abc",
        seqid: 999,
        nome: "Test",
        cpf: "123",
        datanascimento: "",
        sexo: "M",
        profissao: "Test",
        telefone: "",
        celular: "123",
        email: "a@a.com",
        cep: "123",
        endereco: "Rua",
        numero: "1",
        complemento: "",
        bairro: "b",
        cidade: "c",
        uf: "SP",
        anamnese: {}
    };
    const { error } = await db.from('pacientes').insert(patientData);
    console.log("Error:", error);
    await db.from('pacientes').delete().eq('id', 'abc');
}
test();
