const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Searching for duplicate seqid in orcamentos...");
    const { data: orcamentos, error } = await supabase
        .from('orcamentos')
        .select('id, seqid')
        .order('seqid', { ascending: true });

    if (error) {
        console.error("Error fetching orcamentos:", error);
        return;
    }

    const counts = {};
    const duplicates = [];

    orcamentos.forEach(o => {
        counts[o.seqid] = (counts[o.seqid] || 0) + 1;
        if (counts[o.seqid] > 1) {
            duplicates.push(o);
        }
    });

    if (duplicates.length === 0) {
        console.log("No duplicates found according to this fetch! (Maybe check schema cache?)");
    } else {
        console.log(`Found ${duplicates.length} duplicate seqid values.`);
        duplicates.forEach(d => console.log(`ID: ${d.id}, SeqID: ${d.seqid}`));

        console.log("\nProposing cleanup script...");
        // I will generate a SQL script for the user to fix this since I can't easily update many rows via RPC without a loop
    }
}

run();
