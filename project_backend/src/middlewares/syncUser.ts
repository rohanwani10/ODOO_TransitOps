import type { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service';
import { UnauthorizedError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * syncUser
 *
 * Must run after requireAuth (needs req.clerkUserId).
 *
 * 1. Fetches the Clerk user profile from the Clerk API.
 * 2. Upserts the user into the local DB (first-time auto-provision).
 * 3. Attaches the DB user as `req.user`.
 *
 * Usage — compose as a stack on authenticated routers:
 *   router.use(requireAuth, syncUser, requireActive);
 *
 * Or per-route:
 *   router.get('/me', requireAuth, syncUser, authController.getMe);
 */
export async function syncUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.clerkUserId) {
      return next(new UnauthorizedError('No Clerk user ID on request — run requireAuth first'));
    }

    const dbUser = await authService.syncClerkUser(req.clerkUserId);
    req.user = dbUser;
    next();
  } catch (err) {
    logger.error('syncUser: failed to sync user', {
      clerkUserId: req.clerkUserId,
      error: err instanceof Error ? err.message : String(err),
    });
    next(err);
  }
}
