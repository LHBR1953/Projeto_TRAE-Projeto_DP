const fs = require('fs');
const lines = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8').split('\n');
lines.forEach((line, i) => {
  if (line.includes("db.from('orcamento_pagamentos')")) {
    console.log(lines.slice(Math.max(0, i-2), i+3).join('\n'));
    console.log('---');
  }
});
