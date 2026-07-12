import { Router } from 'express';
import { z } from 'zod';
import { requireAuth }    from '../../middlewares/requireAuth';
import { syncUser }       from '../../middlewares/syncUser';
import { requireActive, requireRole, requirePermission } from '../../middlewares/requireRole';
import { validate }       from '../../utils/validate';
import {
  createVehicleSchema,
  updateVehicleSchema,
  updateStatusSchema,
  updateOdometerSchema,
  listVehiclesQuerySchema,
} from './vehicle.validation';
import {
  createVehicle,
  listVehicles,
  getVehicleById,
  getVehicleStats,
  getExpiryAlerts,
  updateVehicle,
  updateVehicleStatus,
  updateVehicleOdometer,
  deleteVehicle,
} from './vehicle.controller';

const router = Router();

// ─── Common middleware stack for all vehicle routes ───────────
// Verifies JWT → syncs DB user → blocks inactive accounts
const auth = [requireAuth, syncUser, requireActive] as const;

// ─── Shared param schema ──────────────────────────────────────
const idParam = z.object({ id: z.string().uuid('Invalid vehicle ID') });

// ═════════════════════════════════════════════════════════════
//  READ — Fleet Manager, Safety Officer, Financial Analyst,
//         Super Admin. Drivers have read access too (they
//         need to see their assigned vehicle).
// ═════════════════════════════════════════════════════════════

/**
 * GET /api/v1/vehicles/stats
 * Fleet-level summary: count per status + total.
 * Must be declared BEFORE /:id to avoid "stats" being treated as a UUID.
 */
router.get(
  '/stats',
  ...auth,
  requirePermission('vehicles:read'),
  getVehicleStats,
);

/**
 * GET /api/v1/vehicles/alerts?days=30
 * Vehicles whose insurance / permit / fitness expires within N days.
 */
router.get(
  '/alerts',
  ...auth,
  requirePermission('vehicles:read'),
  validate({ query: z.object({ days: z.coerce.number().int().positive().max(365).optional() }) }),
  getExpiryAlerts,
);

/**
 * GET /api/v1/vehicles
 * Paginated list with optional filters: status, type, fuelType, search.
 */
router.get(
  '/',
  ...auth,
  requirePermission('vehicles:read'),
  validate({ query: listVehiclesQuerySchema }),
  listVehicles,
);

/**
 * GET /api/v1/vehicles/:id
 * Single vehicle detail.
 */
router.get(
  '/:id',
  ...auth,
  requirePermission('vehicles:read'),
  validate({ params: idParam }),
  getVehicleById,
);

// ═════════════════════════════════════════════════════════════
//  WRITE — Fleet Manager and Super Admin only
// ═════════════════════════════════════════════════════════════

/**
 * POST /api/v1/vehicles
 * Register a new vehicle. Enforces unique reg/chassis/engine.
 */
router.post(
  '/',
  ...auth,
  requireRole('FLEET_MANAGER', 'SUPER_ADMIN'),
  validate({ body: createVehicleSchema }),
  createVehicle,
);

/**
 * PATCH /api/v1/vehicles/:id
 * Update vehicle metadata (make, model, expiry dates, etc.).
 * Does NOT change status or odometer — those have dedicated endpoints.
 */
router.patch(
  '/:id',
  ...auth,
  requireRole('FLEET_MANAGER', 'SUPER_ADMIN'),
  validate({ params: idParam, body: updateVehicleSchema }),
  updateVehicle,
);

/**
 * PATCH /api/v1/vehicles/:id/status
 * Transition vehicle status through the state machine.
 * Valid transitions:
 *   AVAILABLE → ON_TRIP | IN_SHOP | RETIRED
 *   ON_TRIP   → AVAILABLE | IN_SHOP
 *   IN_SHOP   → AVAILABLE | RETIRED
 *   RETIRED   → (no transitions — terminal state)
 */
router.patch(
  '/:id/status',
  ...auth,
  requireRole('FLEET_MANAGER', 'SUPER_ADMIN'),
  validate({ params: idParam, body: updateStatusSchema }),
  updateVehicleStatus,
);

/**
 * PATCH /api/v1/vehicles/:id/odometer
 * Record a new odometer reading. Must be >= current value.
 * Accessible by Fleet Managers (dispatch) and Drivers (self-reporting).
 */
router.patch(
  '/:id/odometer',
  ...auth,
  requireRole('FLEET_MANAGER', 'SUPER_ADMIN', 'DRIVER'),
  validate({ params: idParam, body: updateOdometerSchema }),
  updateVehicleOdometer,
);

/**
 * DELETE /api/v1/vehicles/:id
 * Soft-delete. Blocked if vehicle is ON_TRIP.
 * Returns 204 No Content on success.
 */
router.delete(
  '/:id',
  ...auth,
  requireRole('SUPER_ADMIN'),
  validate({ params: idParam }),
  deleteVehicle,
);

export default router;
