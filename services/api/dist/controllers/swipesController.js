"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swipesController = void 0;
const logger_1 = require("../utils/logger");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
exports.swipesController = {
    // Record a swipe
    recordSwipe: async (req, res) => {
        try {
            const userId = req.user.userId;
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
            const song = await prisma_1.prisma.song.findUnique({
                where: { id: songId }
            });
            if (!song) {
                throw new errorHandler_1.AppError('Song not found', 404);
            }
            // Record the swipe
            const swipe = await prisma_1.prisma.swipe.upsert({
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
                const mutualLikes = await prisma_1.prisma.swipe.findMany({
                    where: {
                        songId,
                        direction: 'like',
                        NOT: { userId }
                    },
                    select: { userId: true }
                });
                for (const mutualLike of mutualLikes) {
                    // Check if the other user also liked songs that this user liked
                    const userLikes = await prisma_1.prisma.swipe.findMany({
                        where: {
                            userId,
                            direction: 'like'
                        },
                        select: { songId: true }
                    });
                    const otherUserLikes = await prisma_1.prisma.swipe.findMany({
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
                        match = await prisma_1.prisma.match.upsert({
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
                        logger_1.logger.info('New match created', {
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
        }
        catch (error) {
            logger_1.logger.error('Error recording swipe', { error });
            throw new errorHandler_1.AppError('Failed to record swipe', 500);
        }
    },
    // Get user's swipe history
    getSwipeHistory: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { page = 1, limit = 20 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const [swipes, total] = await Promise.all([
                prisma_1.prisma.swipe.findMany({
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
                    take: parseInt(limit)
                }),
                prisma_1.prisma.swipe.count({
                    where: { userId }
                })
            ]);
            res.json({
                success: true,
                swipes,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting swipe history', { error });
            throw new errorHandler_1.AppError('Failed to get swipe history', 500);
        }
    }
};
//# sourceMappingURL=swipesController.js.map