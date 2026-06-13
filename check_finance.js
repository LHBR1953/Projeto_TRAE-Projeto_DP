const fs = require('fs');
const lines = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8').split('\n');
lines.forEach((line, i) => {
  if (line.includes("renderBudgets")) {
    console.log(i + ': ' + line.trim());
  }
  if (line.includes("valor_pago") || line.includes("valorpago")) {
    console.log(i + ': ' + line.trim());
  }
});
