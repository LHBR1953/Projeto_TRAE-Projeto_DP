const { createClient } = require('@supabase/supabase-js');
const db = createClient('https://trcktinwjpvcikidrryn.supabase.co', 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA');

async function checkSpecialties() {
    const { data, error } = await db.from('especialidades').select('*');
    if (error) {
        console.error("Error fetching:", error);
    } else {
        console.log("Specialties Count:", data.length);
        if (data.length > 0) {
            console.log("Sample:", data[0]);
        }
    }
}
checkSpecialties();
