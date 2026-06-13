const fs = require('fs');
const content = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app.html', 'utf8');
const idx = content.indexOf('id="budStatus"');
console.log(content.substring(idx - 100, idx + 400));
