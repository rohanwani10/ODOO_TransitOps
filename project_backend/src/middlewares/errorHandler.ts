import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { isDev } from '../config/env';

// ─── Error Response Shape ─────────────────────────────────────
interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  errors?: unknown[];
  stack?: string;
}

// ─── Zod field errors normalizer ─────────────────────────────
function formatZodErrors(err: ZodError) {
  return err.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

// ─── Global Error Handler ─────────────────────────────────────
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // ── Zod Validation Error ────────────────────────────────────
  if (err instanceof ZodError) {
    const body: ErrorResponse = {
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: formatZodErrors(err),
    };
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json(body);
    return;
  }

  // ── Operational AppError ────────────────────────────────────
  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error('AppError', { message: err.message, stack: err.stack });
    }

    const body: ErrorResponse = {
      success: false,
      code: err.code,
      message: err.message,
      ...(isDev && { stack: err.stack }),
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // ── Prisma Known Request Errors ─────────────────────────────
  // Handles unique constraint violations, foreign key errors, etc.
  if (isObject(err) && 'code' in err) {
    const prismaErr = err as { code: string; meta?: Record<string, unknown> };

    if (prismaErr.code === 'P2002') {
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        code: 'UNIQUE_CONSTRAINT',
        message: `Unique constraint violation on: ${String(prismaErr.meta?.['target'])}`,
      });
      return;
    }

    if (prismaErr.code === 'P2025') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Record not found',
      });
      return;
    }
  }

  // ── Unknown / Programmer Errors ─────────────────────────────
  const unknownErr = err instanceof Error ? err : new Error(String(err));

  // CORS errors arrive as plain Error objects (not AppErrors) because the
  // cors() middleware calls callback(new Error('CORS: ...')). Detect them
  // by message prefix and return 403 instead of falling through to 500.
  if (unknownErr.message.startsWith('CORS:')) {
    res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      code: 'CORS_FORBIDDEN',
      message: unknownErr.message,
    });
    return;
  }

  logger.error('Unhandled error', { message: unknownErr.message, stack: unknownErr.stack });

  const body: ErrorResponse = {
    success: false,
    code: 'INTERNAL_ERROR',
    message: isDev ? unknownErr.message : 'An unexpected error occurred',
    ...(isDev && { stack: unknownErr.stack }),
  };
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(body);
}

// ─── 404 Not Found Handler ────────────────────────────────────
export function notFoundHandler(req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

// ─── Helpers ──────────────────────────────────────────────────
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
