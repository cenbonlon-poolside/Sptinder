import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { config } from '../config/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

// Store active connections
const activeConnections = new Map<string, AuthenticatedSocket>();

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    logger.info(`User ${userId} connected`);

    // Store connection
    activeConnections.set(userId, socket);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle chat messages
    socket.on('sendMessage', (data: { matchId: string; message: string }) => {
      logger.info(`Message from ${userId} to match ${data.matchId}: ${data.message}`);

      // Broadcast to match participants
      socket.to(`match:${data.matchId}`).emit('newMessage', {
        from: userId,
        message: data.message,
        timestamp: new Date().toISOString()
      });
    });

    // Join match room
    socket.on('joinMatch', (matchId: string) => {
      socket.join(`match:${matchId}`);
      logger.info(`User ${userId} joined match ${matchId}`);
    });

    // Leave match room
    socket.on('leaveMatch', (matchId: string) => {
      socket.leave(`match:${matchId}`);
      logger.info(`User ${userId} left match ${matchId}`);
    });

    // Handle typing indicators
    socket.on('typing', (data: { matchId: string; isTyping: boolean }) => {
      socket.to(`match:${data.matchId}`).emit('userTyping', {
        userId,
        isTyping: data.isTyping
      });
    });

    // Handle swipe notifications
    socket.on('swipe', (data: { targetUserId: string; action: 'like' | 'pass' }) => {
      const targetSocket = activeConnections.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('swipeNotification', {
          from: userId,
          action: data.action
        });
      }
    });

    // Handle match notifications
    socket.on('match', (data: { matchId: string; matchedUserId: string }) => {
      const matchedSocket = activeConnections.get(data.matchedUserId);
      if (matchedSocket) {
        matchedSocket.emit('newMatch', {
          matchId: data.matchId,
          matchedUserId: userId
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User ${userId} disconnected`);
      activeConnections.delete(userId);
    });
  });
}

// Function to send notification to specific user
export function sendNotification(userId: string, event: string, data: any) {
  const socket = activeConnections.get(userId);
  if (socket) {
    socket.emit(event, data);
  }
}

// Function to broadcast to match
export function broadcastToMatch(io: Server, matchId: string, event: string, data: any) {
  io.to(`match:${matchId}`).emit(event, data);
}