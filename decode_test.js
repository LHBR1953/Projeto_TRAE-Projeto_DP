const fs = require('fs');

const chars = [
  'Ã¢â‚¬Å“', 'Ã¢â‚¬Â', 'Ã‚Â·', 'Ã°Å¸â€™Â¡', 'Ã¢Å¡Â Ã¯Â¸Â', 
  'Ã°Å¸â€œÂ§', 'Ã°Å¸â€â€˜', 'Ã°Å¸â€œâ€¦', 'Ã°Å¸â€˜Â¤', 'Ã°Å¸Â¦Â·',
  'Ã¢ÂÂ¤Ã¯Â¸Â', 'Ã°Å¸â€œÂ', 'Ã°Å¸â€™Â°', 'Ã°Å¸â€™Âµ', 'Ã°Å¸â€Â´', 'Ã°Å¸Å¸Â¢', 'Ã°Å¸Å¸Â¡', 'Ã¢Å¡Âª',
  'Ã¢â€ â€™', 'Ã¢â‚¬â€'
];

let out = '';
chars.forEach(c => {
  out += c + ' -> ' + Buffer.from(c, 'latin1').toString('utf8') + '\n';
});
fs.writeFileSync('c:/Projeto_TRAE/Projeto_DP/decoded.txt', out, 'utf8');
