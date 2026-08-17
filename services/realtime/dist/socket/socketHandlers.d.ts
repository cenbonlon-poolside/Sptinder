import { Server } from 'socket.io';
export declare function setupSocketHandlers(io: Server): void;
export declare function sendNotification(userId: string, event: string, data: any): void;
export declare function broadcastToMatch(io: Server, matchId: string, event: string, data: any): void;
//# sourceMappingURL=socketHandlers.d.ts.map