async function diagnosticoBanco() {
    console.log("Iniciando diagnóstico do banco...");

    // 1. Tentar ler as colunas da tabela orcamentos
    const { data: orcData, error: orcError } = await window.supabaseClient.from('orcamentos').select('*').limit(1);

    if (orcError) {
        console.error("Erro ao ler tabela orcamentos:", orcError);
        alert("Erro ao ler orçamentos: " + orcError.message);
    } else {
        console.log("Exemplo de dados de orçamentos:", orcData[0]);
        const keys = orcData.length > 0 ? Object.keys(orcData[0]) : "Tabela vazia";
        console.log("Colunas encontradas em orçamentos:", keys);

        if (keys.includes('profissional_id')) {
            alert("SUCESSO: A coluna profissional_id EXISTE em orçamentos.");
        } else {
            alert("FALHA: A coluna profissional_id NÃO EXISTE em orçamentos. A migração SQL falhou ou não foi aplicada no projeto correto.");
        }
    }

    // 2. Tentar inserir um registro de teste (opcional/seguro)
    console.log("Diagnóstico concluído.");
}

// Para usar: copie e cole no console do navegador (F12) e digite diagnosticoBanco()
