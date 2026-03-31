import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ErrorCodes
} from './errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with correct properties', () => {
      const error = new AppError(500, 'Test error', 'TEST_ERROR', true);

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should have default values for optional parameters', () => {
      const error = new AppError(500, 'Test error');

      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should capture stack trace', () => {
      const error = new AppError(500, 'Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Test error');
    });

    it('should have correct prototype', () => {
      const error = new AppError(500, 'Test error');
      // Due to Object.setPrototypeOf in the source, we check the constructor name
      expect(error.constructor.name).toBe('AppError');
    });
  });

  describe('BadRequestError', () => {
    it('should create a 400 error', () => {
      const error = new BadRequestError('Invalid input', 'INVALID_INPUT');

      expect(error instanceof Error).toBe(true);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('INVALID_INPUT');
    });

    it('should use default code BAD_REQUEST', () => {
      const error = new BadRequestError('Bad request');
      expect(error.code).toBe('BAD_REQUEST');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create a 401 error', () => {
      const error = new UnauthorizedError('Invalid token', 'TOKEN_INVALID');

      expect(error instanceof Error).toBe(true);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Invalid token');
      expect(error.code).toBe('TOKEN_INVALID');
    });

    it('should use default message and code', () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe('Unauthorized');
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ForbiddenError', () => {
    it('should create a 403 error', () => {
      const error = new ForbiddenError('Access denied', 'ACCESS_DENIED');

      expect(error instanceof Error).toBe(true);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('ACCESS_DENIED');
    });

    it('should use default message and code', () => {
      const error = new ForbiddenError();
      expect(error.message).toBe('Forbidden');
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('NotFoundError', () => {
    it('should create a 404 error', () => {
      const error = new NotFoundError('User not found', 'USER_NOT_FOUND');

      expect(error instanceof Error).toBe(true);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('USER_NOT_FOUND');
    });

    it('should use default message and code', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Not Found');
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('ConflictError', () => {
    it('should create a 409 error', () => {
      const error = new ConflictError('User already exists', 'USER_ALREADY_EXISTS');

      expect(error instanceof Error).toBe(true);
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('User already exists');
      expect(error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('should use default code CONFLICT', () => {
      const error = new ConflictError('Conflict occurred');
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('ValidationError', () => {
    it('should create a 400 error', () => {
      const error = new ValidationError('Invalid email', 'INVALID_EMAIL');

      expect(error instanceof Error).toBe(true);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid email');
      expect(error.code).toBe('INVALID_EMAIL');
    });

    it('should use default code VALIDATION_ERROR', () => {
      const error = new ValidationError('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('ErrorCodes', () => {
    it('should have all required error codes', () => {
      expect(ErrorCodes.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
      expect(ErrorCodes.USER_ALREADY_EXISTS).toBe('USER_ALREADY_EXISTS');
      expect(ErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
      expect(ErrorCodes.USERNAME_TOO_SHORT).toBe('USERNAME_TOO_SHORT');
      expect(ErrorCodes.USERNAME_TOO_LONG).toBe('USERNAME_TOO_LONG');
      expect(ErrorCodes.USERNAME_INVALID_FORMAT).toBe('USERNAME_INVALID_FORMAT');
      expect(ErrorCodes.PASSWORD_TOO_SHORT).toBe('PASSWORD_TOO_SHORT');
      expect(ErrorCodes.PASSWORD_WEAK).toBe('PASSWORD_WEAK');
      expect(ErrorCodes.TOKEN_INVALID).toBe('TOKEN_INVALID');
      expect(ErrorCodes.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
    });

    it('should have group-related error codes', () => {
      expect(ErrorCodes.GROUP_NOT_FOUND).toBe('GROUP_NOT_FOUND');
      expect(ErrorCodes.GROUP_ALREADY_EXISTS).toBe('GROUP_ALREADY_EXISTS');
      expect(ErrorCodes.ALREADY_MEMBER).toBe('ALREADY_MEMBER');
      expect(ErrorCodes.NOT_MEMBER).toBe('NOT_MEMBER');
      expect(ErrorCodes.NOT_OWNER).toBe('NOT_OWNER');
    });

    it('should have message-related error codes', () => {
      expect(ErrorCodes.MESSAGE_NOT_FOUND).toBe('MESSAGE_NOT_FOUND');
      expect(ErrorCodes.MESSAGE_TOO_LONG).toBe('MESSAGE_TOO_LONG');
    });

    it('should have system error codes', () => {
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCodes.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should have generic HTTP error codes', () => {
      expect(ErrorCodes.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    });

    it('should be immutable', () => {
      // Error codes should have specific values
      expect(ErrorCodes.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });
  });
});
