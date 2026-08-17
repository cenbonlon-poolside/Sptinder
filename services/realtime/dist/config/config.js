"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key'
    },
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000'
    }
};
//# sourceMappingURL=config.js.map