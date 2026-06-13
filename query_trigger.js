const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.nmpavhaxrchbshcysryb:Z3B88n72qR6v8rR7@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname = 'occ_orcamento_auto_executado_on_item_finalizado';
  `);
  console.log(res.rows[0].pg_get_functiondef);
  await client.end();
}
run().catch(console.error);