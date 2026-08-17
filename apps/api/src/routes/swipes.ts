import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { swipes } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const swipeBodySchema = z.object({
  trackId: z.string().uuid(),
  direction: z.enum(['left', 'right']),
});

const swipeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: swipeBodySchema,
        response: {
          200: z.object({
            success: z.boolean(),
            swipe: z.object({
              id: z.string(),
              trackId: z.string(),
              direction: z.enum(['left', 'right']),
            }),
          }),
        },
      },
    },
    async (request: FastifyRequest) => {
      const { trackId, direction } = swipeBodySchema.parse(request.body);
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
      schema: {
        response: {
          200: z.object({
            success: z.boolean(),
            swipe: z
              .object({
                id: z.string(),
                trackId: z.string(),
                direction: z.enum(['left', 'right']),
              })
              .nullable(),
          }),
        },
      },
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
      schema: {
        querystring: z.object({
          direction: z.enum(['left', 'right']).optional(),
        }),
        response: {
          200: z.object({
            swipes: z.array(
              z.object({
                id: z.string(),
                track: z.object({
                  id: z.string(),
                  spotifyId: z.string(),
                  name: z.string(),
                  artist: z.string(),
                  album: z.string().nullable(),
                  previewUrl: z.string().nullable(),
                  imageUrl: z.string().nullable(),
                }),
                direction: z.enum(['left', 'right']),
                swipedAt: z.string().datetime(),
              }),
            ),
          }),
        },
      },
    },
    async (request: FastifyRequest) => {
      const userId = (request.user as { userId: string }).userId;
      const { direction } = z.object({ direction: z.enum(['left', 'right']).optional() }).parse(request.query);

      const userSwipes = await db.query.swipes.findMany({
        where: direction ? and(eq(swipes.userId, userId), eq(swipes.direction, direction)) : eq(swipes.userId, userId),
        with: {
          track: true,
        },
        orderBy: desc(swipes.swipedAt),
      });

      return {
        swipes: userSwipes.map((s) => ({
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