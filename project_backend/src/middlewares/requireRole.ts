import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { hasPermission, roleAtLeast } from '../types/auth.types';

// ─── Role guard ───────────────────────────────────────────────

/**
 * requireRole(...roles)
 *
 * Allows access only if the authenticated user's role is one of the
 * provided roles. Must run after requireAuth + syncUser (needs req.user).
 *
 * @example
 * // Allow only Fleet Managers and Super Admins
 * router.post('/vehicles', requireAuth, syncUser, requireRole('FLEET_MANAGER', 'SUPER_ADMIN'), handler);
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('User not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required role: [${roles.join(', ')}]. Your role: ${req.user.role}`,
        ),
      );
    }

    next();
  };
}

// ─── Permission guard ─────────────────────────────────────────

/**
 * requirePermission(permission)
 *
 * Allows access only if the authenticated user's role has the given
 * fine-grained permission key.
 *
 * @example
 * router.get('/expenses', requireAuth, syncUser, requirePermission('expenses:read'), handler);
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('User not authenticated'));
    }

    if (!hasPermission(req.user.role, permission)) {
      return next(
        new ForbiddenError(
          `Access denied. Missing permission: ${permission}`,
        ),
      );
    }

    next();
  };
}

// ─── Minimum-rank guard ───────────────────────────────────────

/**
 * requireMinRole(minimum)
 *
 * Allows access if the user's role ranks >= the given minimum in
 * ROLE_HIERARCHY. Useful for "at least Fleet Manager" type guards.
 *
 * @example
 * router.delete('/trips/:id', requireAuth, syncUser, requireMinRole('FLEET_MANAGER'), handler);
 */
export function requireMinRole(minimum: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('User not authenticated'));
    }

    if (!roleAtLeast(req.user.role, minimum)) {
      return next(
        new ForbiddenError(
          `Access denied. Minimum required role: ${minimum}. Your role: ${req.user.role}`,
        ),
      );
    }

    next();
  };
}

// ─── Active-account guard ─────────────────────────────────────

/**
 * requireActive
 *
 * Blocks suspended / deactivated accounts from accessing any route.
 * Compose it right after syncUser on any authenticated router.
 *
 * @example
 * router.use(requireAuth, syncUser, requireActive);
 */
export function requireActive(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedError('User not authenticated'));
  }

  if (!req.user.isActive) {
    return next(new ForbiddenError('Account is deactivated. Contact your administrator.'));
  }

  next();
}
