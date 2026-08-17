import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import apiRoutes from './routes/index.js';
function getEnv() {
    const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/sptinder';
    return {
        SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
        SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
        DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-please-change-in-production-min-32chars',
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars!!',
        PORT: Number(process.env.PORT || 3000),
        NODE_ENV: (process.env.NODE_ENV || 'development'),
    };
}
const env = getEnv();
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
    fastify.decorate('authenticate', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch (err) {
            reply.send(err);
        }
    });
    // Health check
    fastify.get('/health', async () => ({ status: 'ok' }));
    await fastify.register(apiRoutes, { prefix: '/api' });
    return fastify;
}
async function start() {
    const server = await buildServer();
    try {
        await server.listen({ port: env.PORT, host: '0.0.0.0' });
        server.log.info(`Server listening on port ${env.PORT}`);
    }
    catch (err) {
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
