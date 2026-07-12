import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

// ─── Target Selector ─────────────────────────────────────────
type ValidationTarget = 'body' | 'params' | 'query';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

// ─── Main Middleware Factory ──────────────────────────────────

/**
 * Validates request data against Zod schemas.
 *
 * @example
 * router.post('/trips', validate({ body: createTripSchema }), tripsController.create);
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const targets: ValidationTarget[] = ['body', 'params', 'query'];
    const errors: Array<{ target: string; field: string; message: string }> = [];

    for (const target of targets) {
      const schema = schemas[target];
      if (!schema) continue;

      const result = schema.safeParse(req[target]);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errors.push({
            target,
            field: issue.path.join('.'),
            message: issue.message,
          });
        });
      } else {
        // Replace with parsed & coerced data
        (req as Record<string, unknown>)[target] = result.data;
      }
    }

    if (errors.length > 0) {
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        errors,
      });
      return;
    }

    next();
  };
}

// ─── Standalone parse helper (use in services/controllers) ────

/**
 * Parses and validates data outside of Express middleware context.
 * Throws ZodError on failure.
 *
 * @example
 * const data = parseOrThrow(createTripSchema, req.body);
 */
export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe parse that returns a discriminated union instead of throwing.
 *
 * @example
 * const result = safeParse(createTripSchema, req.body);
 * if (!result.success) { ... }
 */
export function safeParse<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: ZodError } {
  const result = schema.safeParse(data);
  return result;
}

// ─── Common reusable schema fragments ─────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type UuidParam = z.infer<typeof uuidParamSchema>;
