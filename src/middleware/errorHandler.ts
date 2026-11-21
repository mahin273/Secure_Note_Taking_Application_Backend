import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any[];

  constructor(code: ErrorCode, message: string, statusCode: number, details?: any[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Custom operational AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Zod schema validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Express body-parser malformed JSON SyntaxError
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON payload',
      },
    });
    return;
  }

  // Mongoose CastError (e.g. invalid ObjectId format)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid format for ${err.path}`,
      },
    });
    return;
  }

  // Mongoose duplicate key error (code 11000)
  if (err && err.code === 11000) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Duplicate key error: resource already exists',
      },
    });
    return;
  }

  // Fallback 500 Internal Server Error
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
