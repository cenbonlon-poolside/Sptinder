import 'fastify';
import { FastifyReply, FastifyRequest } from 'fastify';

type AuthenticatedUser = {
  userId: string;
  spotifyId: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}