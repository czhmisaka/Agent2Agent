/**
 * 自定义应用错误类
 */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    constructor(statusCode: number, message: string, code?: string, isOperational?: boolean);
}
/**
 * 常见的 HTTP 错误类型
 */
export declare class BadRequestError extends AppError {
    constructor(message: string, code?: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, code?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string, code?: string);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string, code?: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string, code?: string);
}
export declare class ValidationError extends AppError {
    constructor(message: string, code?: string);
}
/**
 * 错误代码常量
 */
export declare const ErrorCodes: {
    readonly USER_NOT_FOUND: "USER_NOT_FOUND";
    readonly USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS";
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly USERNAME_TOO_SHORT: "USERNAME_TOO_SHORT";
    readonly USERNAME_TOO_LONG: "USERNAME_TOO_LONG";
    readonly USERNAME_INVALID_FORMAT: "USERNAME_INVALID_FORMAT";
    readonly PASSWORD_TOO_SHORT: "PASSWORD_TOO_SHORT";
    readonly PASSWORD_WEAK: "PASSWORD_WEAK";
    readonly TOKEN_INVALID: "TOKEN_INVALID";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly GROUP_NOT_FOUND: "GROUP_NOT_FOUND";
    readonly GROUP_ALREADY_EXISTS: "GROUP_ALREADY_EXISTS";
    readonly ALREADY_MEMBER: "ALREADY_MEMBER";
    readonly NOT_MEMBER: "NOT_MEMBER";
    readonly NOT_OWNER: "NOT_OWNER";
    readonly MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND";
    readonly MESSAGE_TOO_LONG: "MESSAGE_TOO_LONG";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    readonly BAD_REQUEST: "BAD_REQUEST";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
};
//# sourceMappingURL=errors.d.ts.map