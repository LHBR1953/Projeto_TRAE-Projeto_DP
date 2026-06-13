const fs = require('fs'); 
const content = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8'); 
const regex = /\.from\(['"]([a-zA-Z_]+)['"]\)/g; 
let match; 
const tables = new Set(); 
while ((match = regex.exec(content)) !== null) { 
  tables.add(match[1]); 
} 
console.log([...tables]);
