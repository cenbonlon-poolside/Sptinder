import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { validateEnv } from './env.js';
import apiRoutes from './routes/index.js';
const env = validateEnv();
async function buildServer() {
    const fastify = Fastify({
        logger: true,
    });
    await fastify.register(cors, {
        origin: true,
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
