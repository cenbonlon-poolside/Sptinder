import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema } from './schema.js';
let pool = null;
function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/sptinder',
        });
    }
    return pool;
}
// Lazy db initialization with relations for query API
let dbInstance = null;
export function getDb() {
    if (!dbInstance) {
        dbInstance = drizzle(getPool(), {
            schema,
        });
    }
    return dbInstance;
}
// Export db for compatibility - initializes on first use
export const db = new Proxy({}, {
    get(_target, prop) {
        const instance = getDb();
        return instance[prop];
    }
});
