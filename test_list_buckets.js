const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const db = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await db.storage.listBuckets();
  console.log("List Buckets Data:", data);
  console.log("List Buckets Error:", error);
}
check();