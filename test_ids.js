const fs = require('fs');
const html = fs.readFileSync('c:\\Projeto_Antigravity\\Projeto_DP\\index.html', 'utf8');
const idRegex = /id=["']([^"']+)["']/g;
const counts = {};
let match;
while ((match = idRegex.exec(html)) !== null) {
    const id = match[1];
    counts[id] = (counts[id] || 0) + 1;
}
console.log('endereco:', counts['endereco']);
console.log('bairro:', counts['bairro']);
console.log('cep:', counts['cep']);
console.log('cidade:', counts['cidade']);
console.log('uf:', counts['uf']);
console.log('Duplicates:', Object.keys(counts).filter(k => counts[k] > 1));
