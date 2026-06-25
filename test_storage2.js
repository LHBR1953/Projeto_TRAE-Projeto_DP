const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const db = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    const fileName = `test_${Date.now()}.txt`;
    const fileContent = "hello world";
    
    // Try to upload to portal_anexos
    const { data, error } = await db.storage
        .from('portal_anexos')
        .upload(`chat/${fileName}`, fileContent, {
            contentType: 'text/plain',
            upsert: false
        });
        
    console.log("Upload result:", data, error);
}

testUpload();