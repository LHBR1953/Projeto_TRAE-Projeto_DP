const fs = require('fs');
const lines = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8').split('\n');
lines.forEach((line, i) => {
  if (line.includes('status:') && (line.toLowerCase().includes('orcamentos') || line.toLowerCase().includes('budget'))) {
    console.log(lines.slice(Math.max(0, i-1), i+2).join('\n'));
    console.log('---');
  }
});
