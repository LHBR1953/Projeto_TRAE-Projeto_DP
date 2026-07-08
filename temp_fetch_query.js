const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'trcktinwjpvcikidrryn.supabase.co',
  port: 443,
  path: '/rest/v1/financeiro_comissoes?select=id,status,valor_comissao,observacao,profissional_id,orcamento_seqid,item_id&limit=10',
  method: 'GET',
  headers: {
    'apikey': 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA',
    'Authorization': 'Bearer sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('c:/Projeto_TRAE/Projeto_DP/https_out.json', data);
    console.log("Feito!");
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
