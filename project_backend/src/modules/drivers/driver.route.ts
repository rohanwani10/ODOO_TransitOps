import { Router } from 'express';
import { z } from 'zod';
import { requireAuth }    from '../../middlewares/requireAuth';
import { syncUser }       from '../../middlewares/syncUser';
import { requireActive, requireRole, requirePermission } from '../../middlewares/requireRole';
import { validate }       from '../../utils/validate';
import {
  createDriverSchema,
  updateDriverSchema,
  updateDriverStatusSchema,
  assignVehicleSchema,
  adjustSafetyScoreSchema,
  listDriversQuerySchema,
} from './driver.validation';
import {
  createDriver,
  listDrivers,
  getDriverStats,
  getLicenseAlerts,
  getMyDriverProfile,
  getDriverById,
  updateDriver,
  updateDriverStatus,
  assignVehicle,
  adjustSafetyScore,
  deleteDriver,
} from './driver.controller';

const router = Router();

// ─── Common auth stack ────────────────────────────────────────
const auth = [requireAuth, syncUser, requireActive] as const;

// ─── Shared param schema ──────────────────────────────────────
const idParam = z.object({ id: z.string().uuid('Invalid driver ID') });

// ─── Shared alert query schema ───────────────────────────────
const alertsQuery = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
});

// ═════════════════════════════════════════════════════════════
//  UTILITY / SUMMARY ROUTES
//  Must be declared before /:id to avoid string params
//  being matched as UUIDs.
// ═════════════════════════════════════════════════════════════

/**
 * GET /api/v1/drivers/stats
 * Status counts, license alert counts, average safety score.
 * Fleet Manager, Safety Officer, Super Admin.
 */
router.get(
  '/stats',
  ...auth,
  requirePermission('drivers:read'),
  getDriverStats,
);

/**
 * GET /api/v1/drivers/license-alerts?days=30
 * Drivers with expiring or already-expired licenses.
 * Fleet Manager, Safety Officer, Super Admin.
 */
router.get(
  '/license-alerts',
  ...auth,
  requirePermission('drivers:read'),
  validate({ query: alertsQuery }),
  getLicenseAlerts,
);

/**
 * GET /api/v1/drivers/me
 * A driver reading their own profile.
 * Only DRIVER role — uses req.user.id as the lookup key.
 */
router.get(
  '/me',
  ...auth,
  requireRole('DRIVER'),
  getMyDriverProfile,
);

// ═════════════════════════════════════════════════════════════
//  CRUD
// ═════════════════════════════════════════════════════════════

/**
 * GET /api/v1/drivers
 * Paginated list with optional filters.
 * All staff roles (not DRIVER).
 */
router.get(
  '/',
  ...auth,
  requirePermission('drivers:read'),
  validate({ query: listDriversQuerySchema }),
  listDrivers,
);

/**
 * GET /api/v1/drivers/:id
 * Single driver detail including user + vehicle summaries.
 * All staff roles (not DRIVER — drivers use /me).
 */
router.get(
  '/:id',
  ...auth,
  requirePermission('drivers:read'),
  validate({ params: idParam }),
  getDriverById,
);

/**
 * POST /api/v1/drivers
 * Register a new driver profile for an existing DRIVER-role user.
 * Fleet Manager, Super Admin.
 */
router.post(
  '/',
  ...auth,
  requireRole('FLEET_MANAGER', 'SUPER_ADMIN'),
  validate({ body: createDriverSchema }),
  createDriver,
);

/**
 * PATCH /api/v1/drivers/:id
 * Update license details, experience, address, emergency contact.
 * Fleet Manager, Super Admin.
 * Does NOT change status, vehicle, or safety score (dedicated endpoints).
 */
router.patch(
  '/:id',
  ...auth,
  requireRole('FLEET_MANAGER', 'SUPER_ADMIN'),
  validate({ params: idParam, body: updateDriverSchema }),
  updateDriver,
);

/**
 * PATCH /api/v1/drivers/:id/status
 * Transition driver status through the state machine.
 * Suspension requires a reason. Safety score penalty applied automatically.
 *
 * Valid transitions:
 *   AVAILABLE  → ON_TRIP | OFF_DUTY | SUSPENDED
 *   ON_TRIP    → AVAILABLE | OFF_DUTY
 *   OFF_DUTY   → AVAILABLE | SUSPENDED
 *   SUSPENDED  → AVAILABLE  (re-activation)
 *
 * Fleet Manager can transition to OFF_DUTY / AVAILABLE.
 * Only Super Admin can SUSPEND.
 */
router.patch(
  '/:id/status',
  ...auth,
  requireRole('FLEET_MANAGER', 'SUPER_ADMIN'),
  validate({ params: idParam, body: updateDriverStatusSchema }),
  updateDriverStatus,
);

/**
 * PATCH /api/v1/drivers/:id/vehicle
 * Assign or unassign (vehicleId: null) a vehicle to a driver.
 * Blocked when driver is ON_TRIP.
 * Vehicle must be AVAILABLE and not already assigned to another driver.
 * Fleet Manager, Super Admin.
 */
router.patch(
  '/:id/vehicle',
  ...auth,
  requireRole('FLEET_MANAGER', 'SUPER_ADMIN'),
  validate({ params: idParam, body: assignVehicleSchema }),
  assignVehicle,
);

/**
 * POST /api/v1/drivers/:id/safety-score
 * Record a safety event and recalculate the driver's score.
 *
 * Event deltas:
 *   TRIP_COMPLETED_ON_TIME  +1.0
 *   TRIP_COMPLETED_LATE     -2.0
 *   TRIP_CANCELLED          -1.0
 *   INCIDENT_REPORTED       -10.0
 *   LICENSE_EXPIRED         -20.0
 *   SUSPENSION              -15.0
 *
 * Safety Officer and Super Admin only — Fleet Manager can read but not adjust.
 */
router.post(
  '/:id/safety-score',
  ...auth,
  requireRole('SAFETY_OFFICER', 'SUPER_ADMIN'),
  validate({ params: idParam, body: adjustSafetyScoreSchema }),
  adjustSafetyScore,
);

/**
 * DELETE /api/v1/drivers/:id
 * Soft-delete. Blocked if driver is ON_TRIP.
 * Super Admin only.
 */
router.delete(
  '/:id',
  ...auth,
  requireRole('SUPER_ADMIN'),
  validate({ params: idParam }),
  deleteDriver,
);

export default router;
