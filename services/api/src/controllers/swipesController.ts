import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';

export const swipesController = {
  // Record a swipe
  recordSwipe: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { songId, direction } = req.body;

      if (!songId || !direction) {
        return res.status(400).json({
          success: false,
          error: 'Song ID and direction are required'
        });
      }

      if (!['like', 'dislike'].includes(direction)) {
        return res.status(400).json({
          success: false,
          error: 'Direction must be either "like" or "dislike"'
        });
      }

      // Check if song exists
      const song = await prisma.song.findUnique({
        where: { id: songId }
      });

      if (!song) {
        throw new AppError('Song not found', 404);
      }

      // Record the swipe
      const swipe = await prisma.swipe.upsert({
        where: {
          userId_songId: {
            userId,
            songId
          }
        },
        update: {
          direction
        },
        create: {
          userId,
          songId,
          direction
        }
      });

      // If it's a like, check for matches
      let match = null;
      if (direction === 'like') {
        // Find users who liked the same song
        const mutualLikes = await prisma.swipe.findMany({
          where: {
            songId,
            direction: 'like',
            NOT: { userId }
          },
          select: { userId: true }
        });

        for (const mutualLike of mutualLikes) {
          // Check if the other user also liked songs that this user liked
          const userLikes = await prisma.swipe.findMany({
            where: {
              userId,
              direction: 'like'
            },
            select: { songId: true }
          });

          const otherUserLikes = await prisma.swipe.findMany({
            where: {
              userId: mutualLike.userId,
              direction: 'like'
            },
            select: { songId: true }
          });

          // Simple matching algorithm: if they have 3+ mutual likes
          const mutualSongIds = userLikes
            .map(l => l.songId)
            .filter(songId => otherUserLikes.some(l => l.songId === songId));

          if (mutualSongIds.length >= 3) {
            // Create match if it doesn't exist
            match = await prisma.match.upsert({
              where: {
                userId_matchedUserId: {
                  userId,
                  matchedUserId: mutualLike.userId
                }
              },
              update: {},
              create: {
                userId,
                matchedUserId: mutualLike.userId
              }
            });

            logger.info('New match created', {
              userId,
              matchedUserId: mutualLike.userId,
              mutualSongs: mutualSongIds.length
            });
            break;
          }
        }
      }

      res.json({
        success: true,
        swipe: {
          id: swipe.id,
          songId: swipe.songId,
          direction: swipe.direction,
          createdAt: swipe.createdAt
        },
        match: match ? {
          id: match.id,
          matchedUserId: match.matchedUserId,
          createdAt: match.createdAt
        } : null
      });

    } catch (error) {
      logger.error('Error recording swipe', { error });
      throw new AppError('Failed to record swipe', 500);
    }
  },

  // Get user's swipe history
  getSwipeHistory: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { page = 1, limit = 20 } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [swipes, total] = await Promise.all([
        prisma.swipe.findMany({
          where: { userId },
          include: {
            song: {
              select: {
                id: true,
                name: true,
                artist: true,
                album: true,
                imageUrl: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit as string)
        }),
        prisma.swipe.count({
          where: { userId }
        })
      ]);

      res.json({
        success: true,
        swipes,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });

    } catch (error) {
      logger.error('Error getting swipe history', { error });
      throw new AppError('Failed to get swipe history', 500);
    }
  }
};