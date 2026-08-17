"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
exports.sendNotification = sendNotification;
exports.broadcastToMatch = broadcastToMatch;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const config_1 = require("../config/config");
// Store active connections
const activeConnections = new Map();
function setupSocketHandlers(io) {
    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
            socket.userId = decoded.userId;
            next();
        }
        catch (err) {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.userId;
        logger_1.logger.info(`User ${userId} connected`);
        // Store connection
        activeConnections.set(userId, socket);
        // Join user-specific room
        socket.join(`user:${userId}`);
        // Handle chat messages
        socket.on('sendMessage', (data) => {
            logger_1.logger.info(`Message from ${userId} to match ${data.matchId}: ${data.message}`);
            // Broadcast to match participants
            socket.to(`match:${data.matchId}`).emit('newMessage', {
                from: userId,
                message: data.message,
                timestamp: new Date().toISOString()
            });
        });
        // Join match room
        socket.on('joinMatch', (matchId) => {
            socket.join(`match:${matchId}`);
            logger_1.logger.info(`User ${userId} joined match ${matchId}`);
        });
        // Leave match room
        socket.on('leaveMatch', (matchId) => {
            socket.leave(`match:${matchId}`);
            logger_1.logger.info(`User ${userId} left match ${matchId}`);
        });
        // Handle typing indicators
        socket.on('typing', (data) => {
            socket.to(`match:${data.matchId}`).emit('userTyping', {
                userId,
                isTyping: data.isTyping
            });
        });
        // Handle swipe notifications
        socket.on('swipe', (data) => {
            const targetSocket = activeConnections.get(data.targetUserId);
            if (targetSocket) {
                targetSocket.emit('swipeNotification', {
                    from: userId,
                    action: data.action
                });
            }
        });
        // Handle match notifications
        socket.on('match', (data) => {
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
            logger_1.logger.info(`User ${userId} disconnected`);
            activeConnections.delete(userId);
        });
    });
}
// Function to send notification to specific user
function sendNotification(userId, event, data) {
    const socket = activeConnections.get(userId);
    if (socket) {
        socket.emit(event, data);
    }
}
// Function to broadcast to match
function broadcastToMatch(io, matchId, event, data) {
    io.to(`match:${matchId}`).emit(event, data);
}
//# sourceMappingURL=socketHandlers.js.map