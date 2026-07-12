import type { Prisma, Driver, DriverStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/prisma';
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../errors/AppError';
import { logger } from '../../utils/logger';
import type {
  DriverDto,
  DriverStats,
  LicenseStatus,
  SafetyEvent,
  CreateDriverDto,
  UpdateDriverDto,
  UpdateDriverStatusDto,
  AssignVehicleDto,
  AdjustSafetyScoreDto,
  ListDriversQuery,
  PaginatedDrivers,
} from './driver.types';

// ─── Constants ────────────────────────────────────────────────

/** Days before expiry at which we surface an EXPIRING_SOON warning. */
const LICENSE_EXPIRY_WARN_DAYS = 30;

/** Safety score bounds */
const SCORE_MAX = 100;
const SCORE_MIN = 0;

/**
 * Safety score delta per event.
 * All deltas are designed so repeated violations eventually floor the score,
 * while consistent good behaviour asymptotically recovers it.
 */
const SAFETY_SCORE_DELTAS: Record<SafetyEvent, number> = {
  TRIP_COMPLETED_ON_TIME:  +1.0,   // incremental reward
  TRIP_COMPLETED_LATE:     -2.0,   // double penalty — punctuality matters
  TRIP_CANCELLED:          -1.0,
  INCIDENT_REPORTED:       -10.0,  // hard hit
  LICENSE_EXPIRED:         -20.0,  // serious compliance failure
  SUSPENSION:              -15.0,
};

// ─── Status transition rules ──────────────────────────────────
const ALLOWED_STATUS_TRANSITIONS: Record<DriverStatus, DriverStatus[]> = {
  AVAILABLE:  ['ON_TRIP', 'OFF_DUTY', 'SUSPENDED'],
  ON_TRIP:    ['AVAILABLE', 'OFF_DUTY'],
  OFF_DUTY:   ['AVAILABLE', 'SUSPENDED'],
  SUSPENDED:  ['AVAILABLE'],  // re-activation requires explicit admin action
};

// ─── Prisma select for all driver reads ───────────────────────
// Always eager-load user and vehicle summaries.
const DRIVER_SELECT = {
  id:              true,
  userId:          true,
  vehicleId:       true,
  licenseNumber:   true,
  licenseClass:    true,
  licenseExpiry:   true,
  status:          true,
  experience:      true,
  address:         true,
  emergencyContact: true,
  rating:          true,
  safetyScore:     true,
  totalTrips:      true,
  createdAt:       true,
  updatedAt:       true,
  user: {
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      email:     true,
      phone:     true,
      avatarUrl: true,
    },
  },
  vehicle: {
    select: {
      id:                 true,
      registrationNumber: true,
      make:               true,
      model:              true,
    },
  },
} satisfies Prisma.DriverSelect;

type DriverWithRelations = Prisma.DriverGetPayload<{ select: typeof DRIVER_SELECT }>;

// ─── Driver Service ───────────────────────────────────────────
export const driverService = {

  // ── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateDriverDto): Promise<DriverDto> {
    // 1. User must exist and not already have a driver profile
    const user = await prisma.user.findUnique({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundError(`User ${dto.userId} not found`);
    }
    if (user.role !== 'DRIVER') {
      throw new BadRequestError(
        `User ${dto.userId} has role "${user.role}". Only users with role DRIVER can have a driver profile.`,
      );
    }

    const existingProfile = await prisma.driver.findUnique({
      where: { userId: dto.userId },
    });
    if (existingProfile) {
      throw new ConflictError(`User ${dto.userId} already has a driver profile`);
    }

    // 2. License number must be unique
    await assertLicenseUnique(dto.licenseNumber);

    // 3. Validate license expiry
    const licenseStatus = computeLicenseStatus(dto.licenseExpiry);
    if (licenseStatus === 'EXPIRED') {
      throw new BadRequestError(
        `Cannot register a driver with an already-expired license (expired: ${dto.licenseExpiry.toISOString().slice(0, 10)})`,
      );
    }

    // 4. Validate vehicle assignment if provided
    if (dto.vehicleId) {
      await assertVehicleAssignable(dto.vehicleId);
    }

    const driver = await prisma.driver.create({
      data: {
        userId:           dto.userId,
        vehicleId:        dto.vehicleId ?? null,
        licenseNumber:    dto.licenseNumber,
        licenseClass:     dto.licenseClass,
        licenseExpiry:    dto.licenseExpiry,
        experience:       dto.experience ?? 0,
        address:          dto.address ?? null,
        emergencyContact: dto.emergencyContact ?? null,
      },
      select: DRIVER_SELECT,
    });

    logger.info('driverService.create: driver profile created', {
      driverId: driver.id,
      userId:   driver.userId,
    });

    return toDto(driver);
  },

  // ── LIST ─────────────────────────────────────────────────────
  async list(query: ListDriversQuery): Promise<PaginatedDrivers> {
    const { page, limit, status, licenseClass, vehicleId, search, licenseExpiringSoon } = query;
    const skip = (page - 1) * limit;

    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + LICENSE_EXPIRY_WARN_DAYS);

    const where: Prisma.DriverWhereInput = {
      deletedAt: null,
      ...(status       && { status }),
      ...(licenseClass && { licenseClass }),
      ...(vehicleId    && { vehicleId }),
      ...(licenseExpiringSoon && {
        licenseExpiry: { lte: expiryThreshold },
      }),
      ...(search && {
        OR: [
          { licenseNumber: { contains: search, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName:  { contains: search, mode: 'insensitive' } },
                { email:     { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const [drivers, total] = await prisma.$transaction([
      prisma.driver.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        select:  DRIVER_SELECT,
      }),
      prisma.driver.count({ where }),
    ]);

    return {
      data: drivers.map(toDto),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  // ── GET ONE ──────────────────────────────────────────────────
  async getById(id: string): Promise<DriverDto> {
    const driver = await findActiveOrThrow(id);
    return toDto(driver);
  },

  // ── GET BY USER ID ────────────────────────────────────────────
  // Used by drivers to fetch their own profile via req.user.id
  async getByUserId(userId: string): Promise<DriverDto> {
    const driver = await prisma.driver.findFirst({
      where:  { userId, deletedAt: null },
      select: DRIVER_SELECT,
    });
    if (!driver) {
      throw new NotFoundError(`No driver profile found for user ${userId}`);
    }
    return toDto(driver);
  },

  // ── UPDATE ───────────────────────────────────────────────────
  async update(id: string, dto: UpdateDriverDto): Promise<DriverDto> {
    const existing = await findActiveOrThrow(id);

    // Re-check license uniqueness if number is being changed
    if (dto.licenseNumber && dto.licenseNumber !== existing.licenseNumber) {
      await assertLicenseUnique(dto.licenseNumber, id);
    }

    // Prevent setting expiry to a past date
    if (dto.licenseExpiry) {
      const status = computeLicenseStatus(dto.licenseExpiry);
      if (status === 'EXPIRED') {
        throw new BadRequestError(
          `License expiry cannot be set to a past date (${dto.licenseExpiry.toISOString().slice(0, 10)})`,
        );
      }
    }

    const driver = await prisma.driver.update({
      where:  { id },
      data:   dto,
      select: DRIVER_SELECT,
    });

    logger.info('driverService.update: driver updated', { id });
    return toDto(driver);
  },

  // ── UPDATE STATUS ─────────────────────────────────────────────
  async updateStatus(id: string, dto: UpdateDriverStatusDto): Promise<DriverDto> {
    const existing = await findActiveOrThrow(id);

    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestError(
        `Invalid status transition: ${existing.status} → ${dto.status}. ` +
        `Allowed: [${allowed.length ? allowed.join(', ') : 'none — terminal state'}]`,
      );
    }

    // A driver ON_TRIP cannot be manually put OFF_DUTY or SUSPENDED
    // until the trip is completed/cancelled.
    if (existing.status === 'ON_TRIP' && dto.status === 'SUSPENDED') {
      throw new BadRequestError(
        'Cannot suspend a driver who is currently ON_TRIP. Complete or cancel the active trip first.',
      );
    }

    // When suspending, also apply the SUSPENSION safety score penalty
    const scoreUpdate: Prisma.DriverUpdateInput = {};
    if (dto.status === 'SUSPENDED') {
      const newScore = clampScore(
        Number(existing.safetyScore) + SAFETY_SCORE_DELTAS.SUSPENSION,
      );
      scoreUpdate.safetyScore = new Decimal(newScore);
    }

    const driver = await prisma.driver.update({
      where:  { id },
      data:   { status: dto.status, ...scoreUpdate },
      select: DRIVER_SELECT,
    });

    logger.info('driverService.updateStatus', {
      id,
      from:   existing.status,
      to:     dto.status,
      reason: dto.reason,
    });

    return toDto(driver);
  },

  // ── ASSIGN / UNASSIGN VEHICLE ─────────────────────────────────
  async assignVehicle(id: string, dto: AssignVehicleDto): Promise<DriverDto> {
    const existing = await findActiveOrThrow(id);

    // Cannot reassign a driver who is currently ON_TRIP
    if (existing.status === 'ON_TRIP') {
      throw new BadRequestError(
        'Cannot change vehicle assignment while driver is ON_TRIP.',
      );
    }

    if (dto.vehicleId !== null) {
      await assertVehicleAssignable(dto.vehicleId, id);
    }

    const driver = await prisma.driver.update({
      where:  { id },
      data:   { vehicleId: dto.vehicleId },
      select: DRIVER_SELECT,
    });

    logger.info('driverService.assignVehicle', {
      driverId:  id,
      vehicleId: dto.vehicleId ?? 'unassigned',
    });

    return toDto(driver);
  },

  // ── ADJUST SAFETY SCORE ───────────────────────────────────────
  async adjustSafetyScore(id: string, dto: AdjustSafetyScoreDto): Promise<DriverDto> {
    const existing = await findActiveOrThrow(id);

    const delta    = SAFETY_SCORE_DELTAS[dto.event];
    const newScore = clampScore(Number(existing.safetyScore) + delta);

    const driver = await prisma.driver.update({
      where:  { id },
      data:   { safetyScore: new Decimal(newScore) },
      select: DRIVER_SELECT,
    });

    logger.info('driverService.adjustSafetyScore', {
      id,
      event:     dto.event,
      delta,
      previous:  Number(existing.safetyScore),
      current:   newScore,
      notes:     dto.notes,
    });

    return toDto(driver);
  },

  // ── SOFT DELETE ───────────────────────────────────────────────
  async softDelete(id: string): Promise<void> {
    const existing = await findActiveOrThrow(id);

    if (existing.status === 'ON_TRIP') {
      throw new BadRequestError(
        'Cannot delete a driver who is currently ON_TRIP.',
      );
    }

    await prisma.driver.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });

    logger.info('driverService.softDelete: driver deleted', { id });
  },

  // ── STATS ─────────────────────────────────────────────────────
  async getStats(): Promise<DriverStats> {
    const now       = new Date();
    const warnDate  = new Date(now.getTime() + LICENSE_EXPIRY_WARN_DAYS * 86_400_000);

    const [statusCounts, licenseExpiring, licenseExpired, avgScore] =
      await prisma.$transaction([
        prisma.driver.groupBy({
          by:     ['status'],
          where:  { deletedAt: null },
          _count: { status: true },
        }),
        prisma.driver.count({
          where: {
            deletedAt:     null,
            licenseExpiry: { gte: now, lte: warnDate },
          },
        }),
        prisma.driver.count({
          where: {
            deletedAt:     null,
            licenseExpiry: { lt: now },
          },
        }),
        prisma.driver.aggregate({
          where:  { deletedAt: null },
          _avg:   { safetyScore: true },
        }),
      ]);

    const byStatus: Record<DriverStatus, number> = {
      AVAILABLE: 0,
      ON_TRIP:   0,
      OFF_DUTY:  0,
      SUSPENDED: 0,
    };
    let total = 0;
    for (const row of statusCounts) {
      byStatus[row.status] = row._count.status;
      total += row._count.status;
    }

    return {
      byStatus,
      total,
      licenseExpiringSoon:  licenseExpiring,
      licenseExpired,
      averageSafetyScore:   Number(avgScore._avg.safetyScore ?? 100),
    };
  },

  // ── LICENSE EXPIRY ALERTS ─────────────────────────────────────
  async getLicenseAlerts(days = LICENSE_EXPIRY_WARN_DAYS): Promise<{
    expiringSoon: DriverDto[];
    expired:      DriverDto[];
  }> {
    const now       = new Date();
    const threshold = new Date(now.getTime() + days * 86_400_000);

    const [expiringSoon, expired] = await prisma.$transaction([
      prisma.driver.findMany({
        where:   { deletedAt: null, licenseExpiry: { gte: now, lte: threshold } },
        orderBy: { licenseExpiry: 'asc' },
        select:  DRIVER_SELECT,
      }),
      prisma.driver.findMany({
        where:   { deletedAt: null, licenseExpiry: { lt: now } },
        orderBy: { licenseExpiry: 'asc' },
        select:  DRIVER_SELECT,
      }),
    ]);

    return {
      expiringSoon: expiringSoon.map(toDto),
      expired:      expired.map(toDto),
    };
  },
};

// ═════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═════════════════════════════════════════════════════════════

async function findActiveOrThrow(id: string): Promise<DriverWithRelations> {
  const driver = await prisma.driver.findFirst({
    where:  { id, deletedAt: null },
    select: DRIVER_SELECT,
  });
  if (!driver) {
    throw new NotFoundError(`Driver with ID ${id} not found`);
  }
  return driver;
}

async function assertLicenseUnique(licenseNumber: string, excludeId?: string): Promise<void> {
  const existing = await prisma.driver.findFirst({
    where: {
      licenseNumber,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (existing) {
    throw new ConflictError(
      `A driver with license number "${licenseNumber}" already exists`,
    );
  }
}

/**
 * assertVehicleAssignable
 * Checks that the vehicle exists, is AVAILABLE, and is not already
 * assigned to another active driver.
 */
async function assertVehicleAssignable(
  vehicleId: string,
  excludeDriverId?: string,
): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, deletedAt: null },
  });
  if (!vehicle) {
    throw new NotFoundError(`Vehicle ${vehicleId} not found`);
  }
  if (vehicle.status === 'RETIRED') {
    throw new BadRequestError(`Vehicle ${vehicleId} is RETIRED and cannot be assigned`);
  }

  const alreadyAssigned = await prisma.driver.findFirst({
    where: {
      vehicleId,
      deletedAt: null,
      ...(excludeDriverId && { id: { not: excludeDriverId } }),
    },
  });
  if (alreadyAssigned) {
    throw new ConflictError(
      `Vehicle ${vehicleId} is already assigned to driver ${alreadyAssigned.id}`,
    );
  }
}

function computeLicenseStatus(expiry: Date): LicenseStatus {
  const now          = new Date();
  const warnThreshold = new Date(now.getTime() + LICENSE_EXPIRY_WARN_DAYS * 86_400_000);

  if (expiry < now)            return 'EXPIRED';
  if (expiry <= warnThreshold) return 'EXPIRING_SOON';
  return 'VALID';
}

function clampScore(score: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score * 100) / 100));
}

// ─── Mapper ───────────────────────────────────────────────────
function toDto(d: DriverWithRelations): DriverDto {
  return {
    id:               d.id,
    userId:           d.userId,
    user: {
      id:        d.user.id,
      firstName: d.user.firstName,
      lastName:  d.user.lastName,
      email:     d.user.email,
      phone:     d.user.phone,
      avatarUrl: d.user.avatarUrl,
    },
    vehicleId: d.vehicleId,
    vehicle:   d.vehicle
      ? {
          id:                 d.vehicle.id,
          registrationNumber: d.vehicle.registrationNumber,
          make:               d.vehicle.make,
          model:              d.vehicle.model,
        }
      : null,
    licenseNumber:    d.licenseNumber,
    licenseClass:     d.licenseClass,
    licenseExpiry:    d.licenseExpiry,
    licenseStatus:    computeLicenseStatus(d.licenseExpiry),
    status:           d.status,
    experience:       d.experience,
    address:          d.address,
    emergencyContact: d.emergencyContact,
    rating:           Number(d.rating),
    safetyScore:      Number(d.safetyScore),
    totalTrips:       d.totalTrips,
    createdAt:        d.createdAt,
    updatedAt:        d.updatedAt,
  };
}
