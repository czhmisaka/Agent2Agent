"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = void 0;
const winston_1 = __importDefault(require("winston"));
// 日志级别
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};
// 日志颜色
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
};
// 自定义格式
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    // 添加元数据
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    // 添加堆栈跟踪
    if (stack) {
        log += `\n${stack}`;
    }
    return log;
}));
// 控制台格式
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), logFormat);
// 创建 logger 实例
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    levels,
    format: logFormat,
    transports: [
        // 控制台输出
        new winston_1.default.transports.Console({
            format: consoleFormat
        }),
        // 错误日志文件
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // 所有日志文件
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // HTTP 请求日志
        new winston_1.default.transports.File({
            filename: 'logs/http.log',
            level: 'http',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});
// 创建 HTTP 请求日志中间件
const httpLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(`${req.method} ${req.originalUrl}`, {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    });
    next();
};
exports.httpLogger = httpLogger;
exports.default = logger;
//# sourceMappingURL=logger.js.map