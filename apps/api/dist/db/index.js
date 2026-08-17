import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { validateEnv } from '../env.js';
const env = validateEnv();
const pool = new Pool({
    connectionString: env.DATABASE_URL,
});
export const db = drizzle(pool, { schema });
