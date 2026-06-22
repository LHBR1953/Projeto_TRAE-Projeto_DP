const mockSupabase = {
    from: (tableName) => {
        return {
            select: () => {
                const builder = {
                    eq: (col, val) => {
                        console.log(`eq called with ${col}=${val} on ${tableName}`);
                        return builder;
                    },
                    order: () => {
                        console.log(`order called on ${tableName}`);
                        return builder;
                    },
                    then: (resolve) => {
                        resolve([{ id: 1 }]);
                    }
                };
                return builder;
            }
        };
    }
};

global.window = { __isMasterTablesMode: true };

const rawDb = mockSupabase;

function createQueryProxy(queryBuilder, tableName) {
    const handler = {
        get(target, prop) {
            const origMethod = target[prop];
            if (typeof origMethod === 'function') {
                return function (...args) {
                    if (prop === 'eq' && args[0] === 'empresa_id' && window.__isMasterTablesMode && tableName.endsWith('_template')) {
                        console.log(`Skipping eq(empresa_id) for ${tableName}`);
                        return new Proxy(target, handler);
                    }
                    const result = origMethod.apply(target, args);
                    if (result && typeof result === 'object') {
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
    await db.from('especialidades_template').select('*').eq('empresa_id', 123).order('id');
    await db.from('especialidades').select('*').eq('empresa_id', 123).order('id');
}

test();
