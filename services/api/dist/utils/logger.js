"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("../config");
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
}));
exports.logger = winston_1.default.createLogger({
    level: config_1.config.logLevel,
    format: logFormat,
    defaultMeta: { service: 'sptinder-api' },
    transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: logFormat
        }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
            format: logFormat
        })
    ]
});
// If we're not in production then log to the console with colors
if (config_1.config.nodeEnv !== 'production') {
    exports.logger.add(new winston_1.default.transports.Console({
        format: consoleFormat
    }));
}
// Create logs directory if it doesn't exist
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
//# sourceMappingURL=logger.js.map