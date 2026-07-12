import type { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { clerkClient } from '../../config/clerk';
import type { AuthUser } from '../../types/auth.types';
import { NotFoundError, UnauthorizedError } from '../../errors/AppError';
import { logger } from '../../utils/logger';

// ─── Webhook event shapes (Clerk svix payloads) ───────────────
interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserCreatedData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  phone_numbers: Array<{ phone_number: string }>;
  public_metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

// ─── Helpers ──────────────────────────────────────────────────

function extractEmail(data: ClerkUserCreatedData): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? '';
}

function extractRole(metadata: Record<string, unknown>): UserRole {
  const allowed: UserRole[] = [
    'SUPER_ADMIN',
    'FLEET_MANAGER',
    'DRIVER',
    'SAFETY_OFFICER',
    'FINANCIAL_ANALYST',
  ];
  const raw = metadata['role'];
  if (typeof raw === 'string' && (allowed as string[]).includes(raw)) {
    return raw as UserRole;
  }
  return 'DRIVER'; // safe default
}

// ─── Auth Service ─────────────────────────────────────────────
export const authService = {
  /**
   * syncClerkUser
   *
   * Called by the syncUser middleware on every authenticated request.
   * - First call for a new Clerk user: fetches their profile from Clerk
   *   and creates the DB row.
   * - Subsequent calls: upserts any changed fields (name, avatar, email).
   * - Respects the role stored in the DB — Clerk public_metadata is only
   *   read on initial creation so admins can override roles in the DB.
   */
  async syncClerkUser(clerkId: string): Promise<AuthUser> {
    // Fetch Clerk profile once — used for both new and existing paths.
    // Map Clerk's own 404 / network errors to a clean 401 so they
    // never bubble up as 500s.
    let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>>;
    try {
      clerkUser = await clerkClient.users.getUser(clerkId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Clerk SDK throws with status 404 when the user has been deleted
      if (message.includes('404') || message.includes('not found')) {
        throw new UnauthorizedError('Clerk user no longer exists');
      }
      // Re-throw network / unexpected errors as-is so the global handler
      // logs them properly; avoid masking programmer errors.
      throw err;
    }

    const data  = clerkUser as unknown as ClerkUserCreatedData;
    const email = extractEmail(data);

    // 1. Existing user — update mutable fields only.
    //    deletedAt: null ensures we never re-activate a soft-deleted account.
    const existing = await prisma.user.findUnique({
      where: { clerkId, deletedAt: null },
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { clerkId },
        data: {
          email:       email || existing.email,
          firstName:   clerkUser.firstName  ?? existing.firstName,
          lastName:    clerkUser.lastName   ?? existing.lastName,
          avatarUrl:   clerkUser.imageUrl   ?? existing.avatarUrl,
          lastLoginAt: new Date(),
        },
      });
      return toAuthUser(updated);
    }

    // 2. New user — provision in DB.
    if (!email) {
      throw new UnauthorizedError('Clerk user has no verified email address');
    }

    const role = extractRole(data.public_metadata);
    logger.info('authService: provisioning new user', { clerkId, email, role });

    const created = await prisma.user.create({
      data: {
        clerkId,
        email,
        firstName:   clerkUser.firstName ?? '',
        lastName:    clerkUser.lastName  ?? '',
        avatarUrl:   clerkUser.imageUrl  ?? null,
        role,
        lastLoginAt: new Date(),
      },
    });

    return toAuthUser(created);
  },

  /**
   * getUserById
   *
   * Fetches a DB user by our internal UUID. Used by the /me endpoint.
   */
  async getUserById(id: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return toAuthUser(user);
  },

  /**
   * updateRole
   *
   * Allows a SUPER_ADMIN to change a user's role directly in the DB.
   * Also writes the role to Clerk public_metadata so it's reflected
   * in the Clerk dashboard.
   */
  async updateRole(userId: string, newRole: UserRole): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update DB
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    // Keep Clerk metadata in sync
    await clerkClient.users.updateUserMetadata(user.clerkId, {
      publicMetadata: { role: newRole },
    });

    logger.info('authService: role updated', {
      userId,
      oldRole: user.role,
      newRole,
    });

    return toAuthUser(updated);
  },

  /**
   * handleWebhookUserDeleted
   *
   * Clerk fires a user.deleted event when a user is removed from Clerk.
   * We soft-delete the local record to preserve referential integrity.
   */
  async handleWebhookUserDeleted(clerkId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { clerkId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });

    logger.info('authService: user soft-deleted via webhook', { clerkId });
  },
};

// ─── Mapper ───────────────────────────────────────────────────
function toAuthUser(
  user: {
    id: string;
    clerkId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    role: UserRole;
    isActive: boolean;
  },
): AuthUser {
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
  };
}
