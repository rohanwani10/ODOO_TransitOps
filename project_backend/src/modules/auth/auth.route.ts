import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/requireAuth';
import { syncUser } from '../../middlewares/syncUser';
import { requireActive, requireRole } from '../../middlewares/requireRole';
import { validate } from '../../utils/validate';
import { getMe, updateUserRole, handleClerkWebhook } from './auth.controller';

const router = Router();

// ─── Request schemas ─────────────────────────────────────────
const updateRoleBody = z.object({
  role: z.enum([
    'SUPER_ADMIN',
    'FLEET_MANAGER',
    'DRIVER',
    'SAFETY_OFFICER',
    'FINANCIAL_ANALYST',
  ]),
});

const userIdParam = z.object({
  id: z.string().uuid('Invalid user ID'),
});

// ─── Authenticated middleware stack ──────────────────────────
// Reused across all protected routes in this router.
const auth = [requireAuth, syncUser, requireActive] as const;

// ─────────────────────────────────────────────────────────────
//  Public Routes
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/webhooks/clerk
 *
 * Receives signed events from Clerk (user.created, user.updated,
 * user.deleted). Uses express.raw() so svix can verify the signature
 * against the raw request bytes — NOT the parsed JSON.
 *
 * Register this URL in:
 *   Clerk Dashboard → Webhooks → Add endpoint
 *   Events to subscribe: user.created, user.updated, user.deleted
 */
router.post(
  '/webhooks/clerk',
  express.raw({ type: 'application/json' }),
  handleClerkWebhook,
);

// ─────────────────────────────────────────────────────────────
//  Authenticated Routes
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's DB profile.
 * All four roles can access their own profile.
 */
router.get('/me', ...auth, getMe);

/**
 * PATCH /api/v1/auth/users/:id/role
 *
 * Updates the role for any user. SUPER_ADMIN only.
 */
router.patch(
  '/users/:id/role',
  ...auth,
  requireRole('SUPER_ADMIN'),
  validate({ params: userIdParam, body: updateRoleBody }),
  updateUserRole,
);

export default router;
