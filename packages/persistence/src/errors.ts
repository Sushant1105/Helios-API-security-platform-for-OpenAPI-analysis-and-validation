export type PersistenceErrorCode =
  | 'DUPLICATE_SPECIFICATION'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_RELATION'
  | 'SPEC_TOO_LARGE'
  | 'INVALID_SPECIFICATION'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR';

export class PersistenceError extends Error {
  public readonly code: PersistenceErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: PersistenceErrorCode,
    statusCode = 400,
    details?: unknown
  ) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, PersistenceError.prototype);
  }
}

export function sanitizeErrorMessage(err: unknown): { code: string; message: string; statusCode: number } {
  if (err instanceof PersistenceError) {
    return {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    };
  }

  // Do not expose raw internal database/system errors
  return {
    code: 'DATABASE_ERROR',
    message: 'An internal persistence error occurred.',
    statusCode: 500,
  };
}
