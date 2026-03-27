"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = exports.ValidationError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
/**
 * 自定义应用错误类
 */
class AppError extends Error {
    statusCode;
    code;
    isOperational;
    constructor(statusCode, message, code = 'INTERNAL_ERROR', isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        // 捕获堆栈跟踪
        Error.captureStackTrace(this, this.constructor);
        // 设置原型链
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
/**
 * 常见的 HTTP 错误类型
 */
class BadRequestError extends AppError {
    constructor(message, code = 'BAD_REQUEST') {
        super(400, message, code);
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        super(401, message, code);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', code = 'FORBIDDEN') {
        super(403, message, code);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(message = 'Not Found', code = 'NOT_FOUND') {
        super(404, message, code);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message, code = 'CONFLICT') {
        super(409, message, code);
    }
}
exports.ConflictError = ConflictError;
class ValidationError extends AppError {
    constructor(message, code = 'VALIDATION_ERROR') {
        super(400, message, code);
    }
}
exports.ValidationError = ValidationError;
/**
 * 错误代码常量
 */
exports.ErrorCodes = {
    // 用户相关错误
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    USERNAME_TOO_SHORT: 'USERNAME_TOO_SHORT',
    USERNAME_TOO_LONG: 'USERNAME_TOO_LONG',
    USERNAME_INVALID_FORMAT: 'USERNAME_INVALID_FORMAT',
    PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
    PASSWORD_WEAK: 'PASSWORD_WEAK',
    TOKEN_INVALID: 'TOKEN_INVALID',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    // 群组相关错误
    GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
    GROUP_ALREADY_EXISTS: 'GROUP_ALREADY_EXISTS',
    ALREADY_MEMBER: 'ALREADY_MEMBER',
    NOT_MEMBER: 'NOT_MEMBER',
    NOT_OWNER: 'NOT_OWNER',
    // 消息相关错误
    MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
    MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
    // 系统错误
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    // 通用错误
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
};
//# sourceMappingURL=errors.js.map