const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const html = fs.readFileSync('c:\\Projeto_Antigravity\\Projeto_DP\\index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });

// Mock fetch
global.fetch = () => Promise.resolve({
    json: () => Promise.resolve({
        logradouro: 'Rua Teste',
        bairro: 'Bairro Teste',
        localidade: 'Cidade Teste',
        uf: 'SP',
        erro: false
    })
});

setTimeout(() => {
    try {
        const doc = dom.window.document;
        // Let's run the exact same logic
        const inputEndereco = doc.getElementById('endereco');
        const inputBairro = doc.getElementById('bairro');
        const inputCidade = doc.getElementById('cidade');
        const inputUf = doc.getElementById('uf');
        const inputCep = doc.getElementById('cep');

        const cep = '01001000';
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(response => response.json())
            .then(data => {
                if (!data.erro) {
                    inputEndereco.value = data.logradouro || '';
                    inputBairro.value = data.bairro || '';
                    inputCidade.value = data.localidade || '';
                    inputUf.value = data.uf || '';

                    // Highlight the auto-filled fields briefly
                    [inputEndereco, inputBairro, inputCidade, inputUf].forEach(input => {
                        input.style.backgroundColor = '#e8f0fe';
                        setTimeout(() => input.style.backgroundColor = '', 1000);
                    });

                    // Focus on the number field since address is filled
                    doc.getElementById('numero').focus();
                    console.log('DOM UPDATE SUCCESS:', inputEndereco.value, inputBairro.value, inputCidade.value, inputUf.value);
                }
            })
            .catch(error => {
                console.error('Error fetching CEP:', error);
            });
    } catch (e) {
        console.error("CRASH:", e);
    }
}, 1000);
