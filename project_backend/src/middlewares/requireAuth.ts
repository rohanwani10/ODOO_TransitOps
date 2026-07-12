import type { Request, Response, NextFunction } from 'express';
import { clerkClient } from '../config/clerk';
import { UnauthorizedError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * requireAuth
 *
 * Verifies the Clerk session token carried in the Authorization header.
 * On success it writes `req.clerkUserId` and calls next().
 * On failure it passes an UnauthorizedError to the global error handler.
 *
 * Usage:
 *   router.use(requireAuth)          // protect an entire router
 *   router.get('/me', requireAuth, handler)  // protect a single route
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing or malformed Authorization header'));
    }

    const token = authHeader.slice(7); // strip "Bearer "

    // verifyToken validates signature, expiry, and issuer against Clerk's JWKS.
    const payload = await clerkClient.verifyToken(token);

    if (!payload?.sub) {
      return next(new UnauthorizedError('Invalid session token'));
    }

    // Attach Clerk's user ID so downstream middleware (syncUser) can use it.
    req.clerkUserId = payload.sub;
    next();
  } catch (err) {
    logger.warn('requireAuth: token verification failed', {
      error: err instanceof Error ? err.message : String(err),
      path: req.path,
    });
    next(new UnauthorizedError('Authentication failed'));
  }
}
