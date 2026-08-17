import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { swipes } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const swipeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest) => {
      const { trackId, direction } = request.body as { trackId: string; direction: 'left' | 'right' };
      const userId = (request.user as { userId: string }).userId;

      const [swipe] = await db
        .insert(swipes)
        .values({
          userId,
          trackId,
          direction,
        })
        .onConflictDoUpdate({
          target: [swipes.userId, swipes.trackId],
          set: { direction },
        })
        .returning();

      return { success: true, swipe: { id: swipe!.id, trackId: swipe!.trackId, direction: swipe!.direction as 'left' | 'right' } };
    },
  );

  fastify.delete(
    '/last',
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest) => {
      const userId = (request.user as { userId: string }).userId;

      const lastSwipe = await db.query.swipes.findFirst({
        where: eq(swipes.userId, userId),
        orderBy: desc(swipes.swipedAt),
      });

      if (!lastSwipe) {
        return { success: true, swipe: null };
      }

      await db.delete(swipes).where(eq(swipes.id, lastSwipe.id));

      return {
        success: true,
        swipe: {
          id: lastSwipe.id,
          trackId: lastSwipe.trackId,
          direction: lastSwipe.direction as 'left' | 'right',
        },
      };
    },
  );

  fastify.get(
    '/history',
    {
      onRequest: [fastify.authenticate],
    },
    async (request: FastifyRequest) => {
      const userId = (request.user as { userId: string }).userId;
      const { direction } = (request.query as { direction?: 'left' | 'right' });

      const userSwipes = await db.query.swipes.findMany({
        where: direction ? and(eq(swipes.userId, userId), eq(swipes.direction, direction)) : eq(swipes.userId, userId),
        with: {
          track: true,
        },
        orderBy: desc(swipes.swipedAt),
      });

      return {
        swipes: userSwipes.map((s: any) => ({
          id: s.id,
          track: {
            id: s.track!.id,
            spotifyId: s.track!.spotifyId,
            name: s.track!.name,
            artist: s.track!.artist,
            album: s.track!.album,
            previewUrl: s.track!.previewUrl,
            imageUrl: s.track!.imageUrl,
          },
          direction: s.direction as 'left' | 'right',
          swipedAt: s.swipedAt.toISOString(),
        })),
      };
    },
  );
};

export default swipeRoutes;