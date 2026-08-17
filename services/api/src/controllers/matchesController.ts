import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';

export const matchesController = {
  // Get user's matches
  getMatches: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const matches = await prisma.match.findMany({
        where: {
          OR: [
            { userId },
            { matchedUserId: userId }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              profileImageUrl: true,
              country: true
            }
          },
          matchedUser: {
            select: {
              id: true,
              displayName: true,
              profileImageUrl: true,
              country: true
            }
          },
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              content: true,
              createdAt: true,
              sender: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Format matches to show the other user
      const formattedMatches = matches.map(match => {
        const isUser1 = match.userId === userId;
        const otherUser = isUser1 ? match.matchedUser : match.user;
        const lastMessage = match.chatMessages[0];

        return {
          id: match.id,
          user: otherUser,
          createdAt: match.createdAt,
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.sender.id,
            senderName: lastMessage.sender.displayName
          } : null
        };
      });

      res.json({ success: true, matches: formattedMatches });
    } catch (error) {
      logger.error('Error getting matches', { error });
      throw new AppError('Failed to get matches', 500);
    }
  },

  // Get match details
  getMatchDetails: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { matchId } = req.params;

      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          OR: [
            { userId },
            { matchedUserId: userId }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              profileImageUrl: true,
              country: true
            }
          },
          matchedUser: {
            select: {
              id: true,
              displayName: true,
              profileImageUrl: true,
              country: true
            }
          }
        }
      });

      if (!match) {
        throw new AppError('Match not found', 404);
      }

      // Return the other user
      const isUser1 = match.userId === userId;
      const otherUser = isUser1 ? match.matchedUser : match.user;

      res.json({
        success: true,
        match: {
          id: match.id,
          user: otherUser,
          createdAt: match.createdAt
        }
      });
    } catch (error) {
      logger.error('Error getting match details', { error, matchId: req.params.matchId });
      throw new AppError('Failed to get match details', 500);
    }
  },

  // Get chat messages for a match
  getChatMessages: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { matchId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Verify user has access to this match
      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          OR: [
            { userId },
            { matchedUserId: userId }
          ]
        }
      });

      if (!match) {
        throw new AppError('Match not found', 404);
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [messages, total] = await Promise.all([
        prisma.chatMessage.findMany({
          where: { matchId },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                profileImageUrl: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit as string)
        }),
        prisma.chatMessage.count({
          where: { matchId }
        })
      ]);

      // Mark messages as read if they're from the other user
      const otherUserId = match.userId === userId ? match.matchedUserId : match.userId;
      await prisma.chatMessage.updateMany({
        where: {
          matchId,
          senderId: otherUserId,
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });

      res.json({
        success: true,
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      logger.error('Error getting chat messages', { error, matchId: req.params.matchId });
      throw new AppError('Failed to get chat messages', 500);
    }
  },

  // Send a message in a match
  sendMessage: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { matchId } = req.params;
      const { content, messageType = 'text', metadata } = req.body;

      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Message content is required'
        });
      }

      // Verify user has access to this match
      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          OR: [
            { userId },
            { matchedUserId: userId }
          ]
        }
      });

      if (!match) {
        throw new AppError('Match not found', 404);
      }

      const message = await prisma.chatMessage.create({
        data: {
          matchId,
          senderId: userId,
          content,
          messageType,
          metadata
        },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              profileImageUrl: true
            }
          }
        }
      });

      logger.info('Message sent', {
        matchId,
        senderId: userId,
        messageType
      });

      res.json({ success: true, message });
    } catch (error) {
      logger.error('Error sending message', { error, matchId: req.params.matchId });
      throw new AppError('Failed to send message', 500);
    }
  }
};