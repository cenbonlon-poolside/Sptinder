import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import apiRoutes from './routes/index.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './db/schema.js';

function getEnv() {
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/sptinder';
  return {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
    DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-please-change-in-production-min-32chars',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars!!',
    PORT: Number(process.env.PORT || 3000),
    NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production',
  };
}

const env = getEnv();

async function runMigrations() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    await migrate(db, { migrationsFolder: './dist/db/migrations' });
    console.log('Migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    // Don't exit - let the server start and handle errors gracefully
  } finally {
    await pool.end();
  }
}

// Initialize database tables directly if migrations fail
async function initTables() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "spotify_id" text NOT NULL UNIQUE,
        "email" text,
        "display_name" text,
        "refresh_token" text,
        "access_token" text,
        "token_expiry" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS "tracks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "spotify_id" text NOT NULL UNIQUE,
        "name" text NOT NULL,
        "artist" text NOT NULL,
        "album" text,
        "preview_url" text,
        "image_url" text,
        "duration_ms" integer,
        "popularity" integer
      );
      CREATE TABLE IF NOT EXISTS "swipes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "track_id" uuid NOT NULL REFERENCES "tracks"("id"),
        "direction" text NOT NULL,
        "swiped_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "swipes_user_id_track_id_unique" UNIQUE("user_id","track_id")
      );
      CREATE TABLE IF NOT EXISTS "playlists" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "spotify_playlist_id" text NOT NULL,
        "name" text DEFAULT 'Sptinder' NOT NULL,
        "synced_at" timestamp
      );
    `);
    console.log('Tables initialized');
  } catch (err) {
    console.error('Table init failed:', err);
  } finally {
    await pool.end();
  }
}

async function buildServer() {
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(cors, {
    origin: ['https://sptinder-web.onrender.com', 'http://localhost:5173'],
    credentials: true,
  });

  await fastify.register(cookie);

  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Try Authorization header first (bypasses bounce tracking)
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          // Manually verify the token and attach to request
          const token = authHeader.slice(7);
          const decoded = fastify.jwt.verify(token) as { userId: string };
          (request as any).user = decoded;
          return;
        }
        // Fall back to cookie
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    },
  );

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  await fastify.register(apiRoutes, { prefix: '/api' });

  return fastify;
}

async function start() {
  // Initialize database tables
  if (env.NODE_ENV === 'production' && env.DATABASE_URL) {
    await initTables();
  }

  const server = await buildServer();

  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`Server listening on port ${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  return server;
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer };

Mon Aug 17 23:53:08 IST 2026
