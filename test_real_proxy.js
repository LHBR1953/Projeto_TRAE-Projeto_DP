const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';

const rawDb = createClient(supabaseUrl, supabaseKey);

global.window = { __isMasterTablesMode: true };

function createQueryProxy(queryBuilder, tableName) {
    const handler = {
        get(target, prop) {
            const origMethod = target[prop];
            if (typeof origMethod === 'function') {
                return function (...args) {
                    if (prop === 'eq' && args[0] === 'empresa_id' && global.window.__isMasterTablesMode && tableName.endsWith('_template')) {
                        console.log(`Skipping eq(empresa_id) for ${tableName}`);
                        return new Proxy(target, handler);
                    }
                    const result = origMethod.apply(target, args);
                    if (result && typeof result === 'object' && prop !== 'then' && prop !== 'catch' && prop !== 'finally') {
                        return new Proxy(result, handler);
                    }
                    return result;
                };
            }
            return origMethod;
        }
    };
    return new Proxy(queryBuilder, handler);
}

const db = new Proxy(rawDb, {
    get(target, prop) {
        if (prop === 'from') {
            return function (tableName) {
                const queryBuilder = target.from(tableName);
                return createQueryProxy(queryBuilder, tableName);
            };
        }
        return target[prop];
    }
});

async function test() {
    try {
        const res1 = await db.from('especialidades_template').select('*').eq('empresa_id', 123).limit(1);
        console.log('Template query success:', !!res1.data);
        const res2 = await db.from('especialidades').select('*').eq('empresa_id', 123).limit(1);
        console.log('Normal query success:', !!res2.data);
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
