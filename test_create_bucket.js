const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const db = createClient(supabaseUrl, supabaseKey);

async function createBuck() {
    const { data, error } = await db.storage.createBucket('occ_documentos', {
        public: true,
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        fileSizeLimit: 10485760 // 10MB
    });
    console.log("Create Bucket Result:", data, error);
}

createBuck();