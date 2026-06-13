const fs = require('fs');
const files = fs.readdirSync('C:/Projeto_TRAE/Projeto_DP/').filter(f => f.endsWith('.js'));
for (const file of files) {
    const code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/' + file, 'utf8');
    if (code.includes('attachAgendaListeners')) {
        console.log(file);
    }
}
