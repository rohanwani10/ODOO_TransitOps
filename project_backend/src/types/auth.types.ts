import type { UserRole } from '@prisma/client';

// ─── Auth User ────────────────────────────────────────────────
// Attached to req.user after requireAuth + syncUser run.
// Contains the DB row, not the raw Clerk token.
export interface AuthUser {
  id: string;        // DB uuid
  clerkId: string;   // Clerk user_xxx id
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
}

// ─── Express Request Augmentation ────────────────────────────
declare global {
  namespace Express {
    interface Request {
      /**
       * Set by requireAuth after the Clerk JWT is verified.
       * Contains the raw Clerk session claims.
       */
      clerkUserId?: string;

      /**
       * Set by syncUser after the DB upsert.
       * Fully typed DB user — safe to use in controllers/services.
       */
      user?: AuthUser;
    }
  }
}

// ─── Role Hierarchy Map ───────────────────────────────────────
// Higher number = more privilege. Used for >= comparisons.
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN:       100,
  FLEET_MANAGER:     60,
  SAFETY_OFFICER:    40,
  FINANCIAL_ANALYST: 40,
  DRIVER:            20,
};

// ─── Role Permission Sets ─────────────────────────────────────
// Explicit permission keys — consumed by requireRole / can() helpers.
export const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  SUPER_ADMIN: ['*'],   // wildcard — all permissions
  FLEET_MANAGER: [
    'vehicles:read',   'vehicles:write',
    'drivers:read',    'drivers:write',
    'trips:read',      'trips:write',
    'maintenance:read',
    'fuel:read',
    'expenses:read',
    'users:read',
  ],
  SAFETY_OFFICER: [
    'vehicles:read',
    'drivers:read',
    'trips:read',
    'maintenance:read', 'maintenance:write',
    'fuel:read',
    'expenses:read',
  ],
  FINANCIAL_ANALYST: [
    'vehicles:read',
    'trips:read',
    'maintenance:read',
    'fuel:read',       'fuel:write',
    'expenses:read',   'expenses:write',
  ],
  DRIVER: [
    'trips:read:own',
    'fuel:write:own',
    'expenses:write:own',
    'profile:read:own', 'profile:write:own',
  ],
};

// ─── Convenience helpers ──────────────────────────────────────

/** Returns true if a role has a given permission (or wildcard). */
export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes('*') || perms.includes(permission);
}

/** Returns true if roleA's hierarchy level is >= roleB's. */
export function roleAtLeast(roleA: UserRole, minimum: UserRole): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[minimum];
}
