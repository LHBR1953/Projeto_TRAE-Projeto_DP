class FakeBuilder {
    constructor(tableName) {
        this.tableName = tableName;
        this.__isTemplateQuery = (tableName.endsWith('_template'));
    }
    select() {
        return this;
    }
    eq(col, val) {
        console.log(`Executing eq(${col}, ${val}) on ${this.tableName}`);
        return this;
    }
    then(resolve, reject) {
        console.log(`Resolving promise for ${this.tableName}`);
        resolve({ data: [{ id: 1 }] });
    }
}

const rawDb = {
    from: (tableName) => new FakeBuilder(tableName)
};

const proxyHandler = {
    get(target, prop, receiver) {
        // Special case to allow Promises to work correctly when proxied
        if (prop === 'then') {
            return target.then.bind(target);
        }
        if (prop === 'catch') {
            return target.catch.bind(target);
        }
        if (prop === 'finally') {
            return target.finally.bind(target);
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
            return function (...args) {
                if (prop === 'eq' && args[0] === 'empresa_id' && target.__isTemplateQuery) {
                    console.log(`Skipping eq(empresa_id) for ${target.tableName}`);
                    return new Proxy(target, proxyHandler);
                }
                const result = value.apply(target, args);
                if (result && typeof result === 'object') {
                    if (target.__isTemplateQuery) {
                        result.__isTemplateQuery = true;
                    }
                    return new Proxy(result, proxyHandler);
                }
                return result;
            };
        }
        return value;
    }
};

const db = {
    from: function(tableName) {
        const builder = rawDb.from(tableName);
        if (tableName.endsWith('_template')) {
            builder.__isTemplateQuery = true;
            return new Proxy(builder, proxyHandler);
        }
        return builder;
    }
};

async function run() {
    const res1 = await db.from('especialidades_template').select().eq('empresa_id', 123).eq('other', 456);
    console.log(res1);
    const res2 = await db.from('especialidades').select().eq('empresa_id', 123);
    console.log(res2);
}

run();