const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const db = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    const fileName = `test_${Date.now()}.txt`;
    const fileContent = "hello world";
    
    // Test if bucket exists by listing buckets
    const { data: buckets, error: bucketError } = await db.storage.listBuckets();
    console.log("Buckets:", buckets ? buckets.map(b => b.name) : bucketError);
    
    // Try to upload
    const { data, error } = await db.storage
        .from('occ_documentos')
        .upload(`chat/${fileName}`, fileContent, {
            contentType: 'text/plain',
            upsert: false
        });
        
    console.log("Upload result:", data, error);
}

testUpload();
