import { createClerkClient } from '@clerk/backend';
import { env } from './env';

// ─── Clerk Client Singleton ───────────────────────────────────
// One instance shared across middleware and auth service.
export const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});
