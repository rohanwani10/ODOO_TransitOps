import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Webhook } from 'svix';
import { authService } from './auth.service';
import { env } from '../../config/env';
import { BadRequestError } from '../../errors/AppError';
import { logger } from '../../utils/logger';
import type { UserRole } from '@prisma/client';

// ─── GET /me ──────────────────────────────────────────────────
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.user is guaranteed by requireAuth + syncUser + requireActive
    res.status(StatusCodes.OK).json({
      success: true,
      data: req.user,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /users/:id/role ────────────────────────────────────
export async function updateUserRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: UserRole };

    const updated = await authService.updateRole(id, role);

    res.status(StatusCodes.OK).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /webhooks/clerk ─────────────────────────────────────
/**
 * Clerk delivers signed webhook events via svix.
 * This endpoint MUST receive the raw request body (not JSON-parsed)
 * so the svix signature can be verified against the raw bytes.
 * The route is mounted with express.raw() — see auth.route.ts.
 */
export async function handleClerkWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const svixId        = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
      return next(new BadRequestError('Missing svix webhook headers'));
    }

    // Verify signature — throws if invalid.
    // req.body is a raw Buffer from express.raw(); svix accepts Buffer | string.
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
    let event: { type: string; data: Record<string, unknown> };

    try {
      event = wh.verify(req.body as Buffer, {
        'svix-id':        String(svixId),
        'svix-timestamp': String(svixTimestamp),
        'svix-signature': String(svixSignature),
      }) as typeof event;
    } catch {
      logger.warn('handleClerkWebhook: invalid svix signature');
      return next(new BadRequestError('Webhook signature verification failed'));
    }

    logger.info('handleClerkWebhook: received event', { type: event.type });

    // ── Event routing ─────────────────────────────────────────
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        // syncClerkUser will provision / update the user on the next
        // authenticated request. We handle it here too for background
        // accounts (e.g., admins created without a session open).
        const clerkId = event.data['id'] as string;
        await authService.syncClerkUser(clerkId);
        break;
      }
      case 'user.deleted': {
        const clerkId = event.data['id'] as string;
        await authService.handleWebhookUserDeleted(clerkId);
        break;
      }
      default:
        logger.info('handleClerkWebhook: unhandled event type', { type: event.type });
    }

    res.status(StatusCodes.OK).json({ received: true });
  } catch (err) {
    next(err);
  }
}
