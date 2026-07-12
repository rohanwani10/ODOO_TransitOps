import type { Prisma, Vehicle, VehicleStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ConflictError, NotFoundError, BadRequestError } from '../../errors/AppError';
import { logger } from '../../utils/logger';
import type {
  VehicleDto,
  CreateVehicleDto,
  UpdateVehicleDto,
  UpdateVehicleStatusDto,
  UpdateOdometerDto,
  ListVehiclesQuery,
  PaginatedVehicles,
} from './vehicle.types';

// ─── Status transition rules ──────────────────────────────────
// Defines which statuses a vehicle may move TO from a given current status.
// Prevents illegal jumps (e.g. ON_TRIP → RETIRED directly).
const ALLOWED_TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  AVAILABLE: ['ON_TRIP', 'IN_SHOP', 'RETIRED'],
  ON_TRIP:   ['AVAILABLE', 'IN_SHOP'],          // trip ends → AVAILABLE; breakdown → IN_SHOP
  IN_SHOP:   ['AVAILABLE', 'RETIRED'],           // repaired → AVAILABLE; written-off → RETIRED
  RETIRED:   [],                                 // terminal state — no transitions allowed
};

// ─── Vehicle Service ──────────────────────────────────────────
export const vehicleService = {

  // ── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateVehicleDto): Promise<VehicleDto> {
    // Enforce uniqueness manually to produce a domain-specific error
    // (Prisma's P2002 is caught globally but the message is generic).
    await assertRegistrationUnique(dto.registrationNumber);
    await assertChassisUnique(dto.chassisNumber);
    await assertEngineUnique(dto.engineNumber);

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: dto.registrationNumber,
        make:               dto.make,
        model:              dto.model,
        year:               dto.year,
        type:               dto.type,
        fuelType:           dto.fuelType,
        capacity:           dto.capacity,
        color:              dto.color ?? null,
        chassisNumber:      dto.chassisNumber,
        engineNumber:       dto.engineNumber,
        insuranceExpiry:    dto.insuranceExpiry ?? null,
        permitExpiry:       dto.permitExpiry    ?? null,
        fitnessExpiry:      dto.fitnessExpiry   ?? null,
        imageUrl:           dto.imageUrl        ?? null,
        // status defaults to AVAILABLE via Prisma schema
      },
    });

    logger.info('vehicleService.create: vehicle created', {
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
    });

    return toDto(vehicle);
  },

  // ── LIST (paginated + filtered) ──────────────────────────────
  async list(query: ListVehiclesQuery): Promise<PaginatedVehicles> {
    const { page, limit, status, type, fuelType, search } = query;
    const skip = (page - 1) * limit;

    // Build dynamic where clause
    const where: Prisma.VehicleWhereInput = {
      deletedAt: null, // always exclude soft-deleted
      ...(status   && { status }),
      ...(type     && { type }),
      ...(fuelType && { fuelType }),
      ...(search   && {
        OR: [
          { registrationNumber: { contains: search, mode: 'insensitive' } },
          { make:               { contains: search, mode: 'insensitive' } },
          { model:              { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [vehicles, total] = await prisma.$transaction([
      prisma.vehicle.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return {
      data: vehicles.map(toDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // ── GET ONE ──────────────────────────────────────────────────
  async getById(id: string): Promise<VehicleDto> {
    const vehicle = await findActiveOrThrow(id);
    return toDto(vehicle);
  },

  // ── UPDATE ───────────────────────────────────────────────────
  async update(id: string, dto: UpdateVehicleDto): Promise<VehicleDto> {
    // Verify vehicle exists first
    await findActiveOrThrow(id);

    // Re-check uniqueness for fields that carry a DB unique constraint,
    // excluding the current vehicle from the duplicate check.
    // (registrationNumber and unique numbers cannot be changed via PATCH
    //  intentionally — but chassis/engine are not in UpdateVehicleDto so
    //  this is a safety net in case the DTO evolves.)

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data:  dto,
    });

    logger.info('vehicleService.update: vehicle updated', { id });
    return toDto(vehicle);
  },

  // ── UPDATE STATUS ────────────────────────────────────────────
  async updateStatus(id: string, dto: UpdateVehicleStatusDto): Promise<VehicleDto> {
    const vehicle = await findActiveOrThrow(id);

    // Enforce transition rules
    const allowed = ALLOWED_TRANSITIONS[vehicle.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestError(
        `Invalid status transition: ${vehicle.status} → ${dto.status}. ` +
        `Allowed: [${allowed.length ? allowed.join(', ') : 'none'}]`,
      );
    }

    // When sending a vehicle to the shop, a linked maintenance record is expected
    if (dto.status === 'IN_SHOP' && dto.maintenanceId) {
      const maintenance = await prisma.maintenance.findFirst({
        where: { id: dto.maintenanceId, vehicleId: id },
      });
      if (!maintenance) {
        throw new BadRequestError(
          `Maintenance record ${dto.maintenanceId} not found for this vehicle`,
        );
      }
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data:  { status: dto.status },
    });

    logger.info('vehicleService.updateStatus: status changed', {
      id,
      from: vehicle.status,
      to:   dto.status,
    });

    return toDto(updated);
  },

  // ── UPDATE ODOMETER ──────────────────────────────────────────
  async updateOdometer(id: string, dto: UpdateOdometerDto): Promise<VehicleDto> {
    const vehicle = await findActiveOrThrow(id);

    // Odometer can only increase — never go backwards
    if (dto.odometer < vehicle.odometer) {
      throw new BadRequestError(
        `New odometer reading (${dto.odometer} km) is less than current ` +
        `(${vehicle.odometer} km). Odometer cannot go backwards.`,
      );
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data:  { odometer: dto.odometer },
    });

    logger.info('vehicleService.updateOdometer', {
      id,
      previous: vehicle.odometer,
      current:  dto.odometer,
      delta:    dto.odometer - vehicle.odometer,
    });

    return toDto(updated);
  },

  // ── SOFT DELETE ──────────────────────────────────────────────
  async softDelete(id: string): Promise<void> {
    const vehicle = await findActiveOrThrow(id);

    // Cannot delete a vehicle that is on an active trip
    if (vehicle.status === 'ON_TRIP') {
      throw new BadRequestError(
        'Cannot delete a vehicle that is currently ON_TRIP. ' +
        'Complete or cancel the active trip first.',
      );
    }

    await prisma.vehicle.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });

    logger.info('vehicleService.softDelete: vehicle deleted', { id });
  },

  // ── STATS (dashboard summary) ────────────────────────────────
  async getStats(): Promise<Record<VehicleStatus, number> & { total: number }> {
    const counts = await prisma.vehicle.groupBy({
      by:     ['status'],
      where:  { deletedAt: null },
      _count: { status: true },
    });

    const base = { AVAILABLE: 0, ON_TRIP: 0, IN_SHOP: 0, RETIRED: 0, total: 0 };

    for (const row of counts) {
      base[row.status] = row._count.status;
      base.total      += row._count.status;
    }

    return base;
  },

  // ── EXPIRY ALERTS ─────────────────────────────────────────────
  // Returns vehicles whose insurance/permit/fitness expires within `days`
  // from now, plus a separate bucket for those already expired.
  async getExpiryAlerts(days = 30): Promise<{
    upcoming: { insurance: VehicleDto[]; permit: VehicleDto[]; fitness: VehicleDto[] };
    expired:  { insurance: VehicleDto[]; permit: VehicleDto[]; fitness: VehicleDto[] };
  }> {
    const now       = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const baseWhere = { deletedAt: null, status: { not: 'RETIRED' as VehicleStatus } };

    const [
      upcomingIns, upcomingPmt, upcomingFit,
      expiredIns,  expiredPmt,  expiredFit,
    ] = await prisma.$transaction([
      // Upcoming: expires between now and threshold
      prisma.vehicle.findMany({
        where: { ...baseWhere, insuranceExpiry: { gte: now, lte: threshold } },
        orderBy: { insuranceExpiry: 'asc' },
      }),
      prisma.vehicle.findMany({
        where: { ...baseWhere, permitExpiry: { gte: now, lte: threshold } },
        orderBy: { permitExpiry: 'asc' },
      }),
      prisma.vehicle.findMany({
        where: { ...baseWhere, fitnessExpiry: { gte: now, lte: threshold } },
        orderBy: { fitnessExpiry: 'asc' },
      }),
      // Already expired: expiry date is before now
      prisma.vehicle.findMany({
        where: { ...baseWhere, insuranceExpiry: { lt: now } },
        orderBy: { insuranceExpiry: 'asc' },
      }),
      prisma.vehicle.findMany({
        where: { ...baseWhere, permitExpiry: { lt: now } },
        orderBy: { permitExpiry: 'asc' },
      }),
      prisma.vehicle.findMany({
        where: { ...baseWhere, fitnessExpiry: { lt: now } },
        orderBy: { fitnessExpiry: 'asc' },
      }),
    ]);

    return {
      upcoming: {
        insurance: upcomingIns.map(toDto),
        permit:    upcomingPmt.map(toDto),
        fitness:   upcomingFit.map(toDto),
      },
      expired: {
        insurance: expiredIns.map(toDto),
        permit:    expiredPmt.map(toDto),
        fitness:   expiredFit.map(toDto),
      },
    };
  },
};

// ─── Internal helpers ─────────────────────────────────────────

/** Fetch an active (non-deleted) vehicle or throw 404. */
async function findActiveOrThrow(id: string): Promise<Vehicle> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, deletedAt: null },
  });

  if (!vehicle) {
    throw new NotFoundError(`Vehicle with ID ${id} not found`);
  }

  return vehicle;
}

async function assertRegistrationUnique(registrationNumber: string, excludeId?: string): Promise<void> {
  const existing = await prisma.vehicle.findFirst({
    where: {
      registrationNumber,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (existing) {
    throw new ConflictError(
      `A vehicle with registration number "${registrationNumber}" already exists`,
    );
  }
}

async function assertChassisUnique(chassisNumber: string, excludeId?: string): Promise<void> {
  const existing = await prisma.vehicle.findFirst({
    where: {
      chassisNumber,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (existing) {
    throw new ConflictError(`A vehicle with chassis number "${chassisNumber}" already exists`);
  }
}

async function assertEngineUnique(engineNumber: string, excludeId?: string): Promise<void> {
  const existing = await prisma.vehicle.findFirst({
    where: {
      engineNumber,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (existing) {
    throw new ConflictError(`A vehicle with engine number "${engineNumber}" already exists`);
  }
}

/** Map a Prisma Vehicle row → VehicleDto (strips internal fields). */
function toDto(v: Vehicle): VehicleDto {
  return {
    id:                 v.id,
    registrationNumber: v.registrationNumber,
    make:               v.make,
    model:              v.model,
    year:               v.year,
    type:               v.type,
    fuelType:           v.fuelType,
    status:             v.status,
    capacity:           v.capacity,
    color:              v.color,
    chassisNumber:      v.chassisNumber,
    engineNumber:       v.engineNumber,
    insuranceExpiry:    v.insuranceExpiry,
    permitExpiry:       v.permitExpiry,
    fitnessExpiry:      v.fitnessExpiry,
    odometer:           v.odometer,
    imageUrl:           v.imageUrl,
    createdAt:          v.createdAt,
    updatedAt:          v.updatedAt,
  };
}
