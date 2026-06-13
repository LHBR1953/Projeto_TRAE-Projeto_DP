const fs = require('fs');
const iconv = require('iconv-lite');

const chars = [
  'Ã¢â‚¬Å“', 'Ã¢â‚¬Â', 'Ã‚Â·', 'Ã°Å¸â€™Â¡', 'Ã¢Å¡Â Ã¯Â¸Â', 
  'Ã°Å¸â€œÂ§', 'Ã°Å¸â€â€˜', 'Ã°Å¸â€œâ€¦', 'Ã°Å¸â€˜Â¤', 'Ã°Å¸Â¦Â·',
  'Ã¢ÂÂ¤Ã¯Â¸Â', 'Ã°Å¸â€œÂ', 'Ã°Å¸â€™Â°', 'Ã°Å¸â€™Âµ', 'Ã°Å¸â€Â´', 'Ã°Å¸Å¸Â¢', 'Ã°Å¸Å¸Â¡', 'Ã¢Å¡Âª',
  'Ã¢â€ â€™', 'Ã¢â‚¬â€'
];

let out = '';
chars.forEach(c => {
  // Convert from utf8 to buffer, then read as cp1252
  // Wait, the string 'Ã¢â‚¬Å“' is currently utf-8. 
  // It represents the bytes of CP1252, which were originally the bytes of UTF-8.
  
  // 1. Get the bytes of the corrupted string if it was encoded in UTF-8
  // 2. We actually want to go backwards: 
  //   original UTF-8 -> decoded as CP1252 -> saved as UTF-8 (corrupted)
  // So to reverse: corrupted UTF-8 string -> encode to CP1252 bytes -> decode as UTF-8 string.
  
  const buf = iconv.encode(c, 'utf8');
  // wait, the string c is already in js memory.
  // let's encode it to cp1252 bytes.
  const cp1252Bytes = iconv.encode(c, 'cp1252');
  // then decode those bytes as utf8
  const original = iconv.decode(cp1252Bytes, 'utf8');
  
  out += c + ' -> ' + original + '\n';
});
fs.writeFileSync('c:/Projeto_TRAE/Projeto_DP/decoded.txt', out, 'utf8');
