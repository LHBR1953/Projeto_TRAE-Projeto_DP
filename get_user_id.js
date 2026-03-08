
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getUserId() {
    const email = 'lhbr@lhbr.com.br';
    const password = '123456';

    console.log(`Getting ID for ${email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error('Login error:', error.message);
    } else {
        console.log(`USER_ID:${data.user.id}`);
    }
}

getUserId();
