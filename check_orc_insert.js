const fs = require('fs');
const lines = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8').split('\n');
lines.forEach((line, i) => {
  if (line.includes("db.from('orcamentos').insert")) {
    console.log(lines.slice(Math.max(0, i-5), i+10).join('\n'));
    console.log('---');
  }
});
