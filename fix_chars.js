const fs = require('fs');
let content = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v20.js', 'utf8');

const replacements = {
  'Ã¢â‚¬â€': '—',
  'Ã¢â‚¬Â¢': '•',
  'Ã¢Â­Â': '⭐',
  'Ã¢â€ â€™': '→',
  'Ã¢â€ Â': '←',
  'Ã¢â€ â€˜': '↑',
  'Ã¢â€ â€œ': '↓',
  'Ã¢â€”Â': '●'
};

let replacedCount = 0;
for (const [bad, good] of Object.entries(replacements)) {
  const count = (content.split(bad).length - 1);
  if (count > 0) {
    replacedCount += count;
    content = content.split(bad).join(good);
    console.log(`Replaced ${count} occurrences of ${bad} with ${good}`);
  }
}

if (replacedCount > 0) {
  fs.writeFileSync('c:/Projeto_TRAE/Projeto_DP/app_v20.js', content, 'utf8');
  console.log(`Successfully fixed ${replacedCount} broken characters in app_v20.js`);
} else {
  console.log('No broken characters found.');
}
