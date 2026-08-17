import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import staticPlugin from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnv } from './env.js';
import apiRoutes from './routes/index.js';

const env = validateEnv();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    },
  );

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Serve web frontend
  await fastify.register(staticPlugin, {
    root: path.join(__dirname, '../../web/dist'),
    prefix: '/',
  });

  await fastify.register(apiRoutes, { prefix: '/api' });

  // Serve index.html for all non-API routes (SPA support)
  fastify.setNotFoundHandler(async (_request, reply) => {
    return reply.sendFile('index.html');
  });

  return fastify;
}

async function start() {
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