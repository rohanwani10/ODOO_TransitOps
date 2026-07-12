import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    createdResponse,
    errorResponse,
    Errors,
    successResponse,
    type ApiMeta,
} from "@/lib/api-response";
import {
    isForeignKeyError,
    isUniqueConstraintError,
} from "@/lib/prisma-errors";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const fuelTypeSchema = z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG"]);

/**
 * Create schema — enforces all SRS §10 validation rules:
 * - quantity (liters) > 0
 * - pricePerUnit > 0
 * - odometerKm >= 0
 * - filledAt (log_date) cannot be a future date
 */
const fuelCreateSchema = z
    .object({
        vehicleId: z.string().trim().min(1, "vehicleId is required"),
        driverId: z.string().trim().min(1, "driverId is required"),
        tripId: z.string().trim().min(1).optional().nullable(),
        fuelType: fuelTypeSchema,
        // SRS §10: liters > 0
        quantity: z.coerce
            .number({ invalid_type_error: "quantity must be a number" })
            .positive("Liters must be greater than 0"),
        // cost per litre > 0
        pricePerUnit: z.coerce
            .number({ invalid_type_error: "pricePerUnit must be a number" })
            .positive("Price per unit must be greater than 0"),
        // totalCost is auto-computed; if supplied it must be >= 0
        totalCost: z.coerce.number().nonnegative("Total cost cannot be negative").optional(),
        // SRS §10: odometer >= 0
        odometerKm: z.coerce
            .number({ invalid_type_error: "odometerKm must be a number" })
            .int("odometerKm must be an integer")
            .nonnegative("Odometer reading cannot be negative"),
        station: z.string().trim().min(1).optional().nullable(),
        // SRS §10: date fields cannot be in the future (validated below in superRefine)
        filledAt: z.coerce.date().optional().nullable(),
    })
    .strict()
    .superRefine((val, ctx) => {
        if (val.filledAt && val.filledAt > new Date()) {
            ctx.addIssue({
                code: "custom",
                path: ["filledAt"],
                message: "filledAt cannot be a future date",
            });
        }
    });

/**
 * Partial update schema — at least one field must be provided.
 */
const fuelUpdateSchema = fuelCreateSchema
    .partial()
    .superRefine((val, ctx) => {
        if (Object.keys(val).length === 0) {
            ctx.addIssue({ code: "custom", message: "At least one field is required" });
        }
        if (val.filledAt && val.filledAt > new Date()) {
            ctx.addIssue({
                code: "custom",
                path: ["filledAt"],
                message: "filledAt cannot be a future date",
            });
        }
    });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePagination(url: URL) {
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
    return { page, limit, skip: (page - 1) * limit };
}

function buildFuelWhere(url: URL) {
    const q = url.searchParams.get("q")?.trim();
    const vehicleId = url.searchParams.get("vehicleId")?.trim();
    const driverId = url.searchParams.get("driverId")?.trim();
    const tripId = url.searchParams.get("tripId")?.trim();
    const fuelType = url.searchParams.get("fuelType")?.trim();
    const dateFrom = url.searchParams.get("dateFrom")?.trim();
    const dateTo = url.searchParams.get("dateTo")?.trim();

    const filters: Record<string, unknown>[] = [];

    // Full-text search across station & related entity identifiers
    if (q) {
        filters.push({
            OR: [
                { station: { contains: q, mode: "insensitive" as const } },
                { vehicle: { registrationNo: { contains: q, mode: "insensitive" as const } } },
                { driver: { user: { name: { contains: q, mode: "insensitive" as const } } } },
            ],
        });
    }

    if (vehicleId) filters.push({ vehicleId });
    if (driverId) filters.push({ driverId });
    if (tripId) filters.push({ tripId });

    // Fuel type filter — only apply if it's a valid enum value
    if (fuelType && fuelTypeSchema.safeParse(fuelType).success) {
        filters.push({ fuelType });
    }

    // Date range on filledAt
    if (dateFrom || dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (dateFrom) {
            const from = new Date(dateFrom);
            if (!isNaN(from.getTime())) dateFilter.gte = from;
        }
        if (dateTo) {
            const to = new Date(dateTo);
            if (!isNaN(to.getTime())) {
                // Include the full end day
                to.setHours(23, 59, 59, 999);
                dateFilter.lte = to;
            }
        }
        if (Object.keys(dateFilter).length > 0) {
            filters.push({ filledAt: dateFilter });
        }
    }

    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0];
    return { AND: filters };
}

function buildFuelCreateData(input: z.infer<typeof fuelCreateSchema>) {
    return {
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        tripId: input.tripId ?? null,
        fuelType: input.fuelType,
        quantity: input.quantity,
        pricePerUnit: input.pricePerUnit,
        // Auto-compute totalCost if not provided
        totalCost: input.totalCost ?? parseFloat((input.quantity * input.pricePerUnit).toFixed(2)),
        odometerKm: input.odometerKm,
        station: input.station ?? null,
        filledAt: input.filledAt ?? new Date(),
    };
}

/**
 * Verify referenced entities exist before creating.
 * Returns an error response if any FK target is missing, otherwise null.
 */
async function validateFuelForeignKeys(
    vehicleId: string,
    driverId: string,
    tripId?: string | null,
): Promise<NextResponse | null> {
    const [vehicle, driver] = await Promise.all([
        prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } }),
        prisma.driver.findUnique({ where: { id: driverId }, select: { id: true } }),
    ]);

    if (!vehicle) {
        return errorResponse("FK_VIOLATION", "Vehicle not found", 409, {
            vehicleId: "Referenced vehicle does not exist",
        });
    }
    if (!driver) {
        return errorResponse("FK_VIOLATION", "Driver not found", 409, {
            driverId: "Referenced driver does not exist",
        });
    }
    if (tripId) {
        const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
        if (!trip) {
            return errorResponse("FK_VIOLATION", "Trip not found", 409, {
                tripId: "Referenced trip does not exist",
            });
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/fuel-logs
 *
 * Query params:
 *   q         — full-text search (station, vehicle reg, driver name)
 *   vehicleId — filter by vehicle
 *   driverId  — filter by driver
 *   tripId    — filter by trip
 *   fuelType  — filter by fuel type enum
 *   dateFrom  — ISO date, start of range on filledAt
 *   dateTo    — ISO date, end of range on filledAt
 *   page      — default 1
 *   limit     — default 10, max 100
 *
 * TODO: Integrate auth → restrict DRIVER role to own driverId only.
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const { page, limit, skip } = parsePagination(url);
        const where = buildFuelWhere(url);

        const [items, total] = await prisma.$transaction([
            prisma.fuelLog.findMany({
                where,
                orderBy: { filledAt: "desc" },
                skip,
                take: limit,
                include: {
                    vehicle: { select: { id: true, registrationNo: true, make: true, model: true } },
                    driver: { select: { id: true, user: { select: { name: true } } } },
                    trip: { select: { id: true, origin: true, destination: true } },
                },
            }),
            prisma.fuelLog.count({ where }),
        ]);

        const meta: ApiMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        };

        return successResponse(items, meta);
    } catch (error) {
        console.error("[fuel-logs:GET]", error);
        return Errors.internal();
    }
}

/**
 * POST /api/fuel-logs
 *
 * Creates a new fuel log entry.
 *
 * Validation rules (SRS §10):
 * - quantity (liters) > 0
 * - pricePerUnit > 0
 * - odometerKm >= 0
 * - filledAt cannot be a future date
 * - vehicleId, driverId must reference existing records
 * - tripId (if provided) must reference an existing trip
 *
 * Business logic:
 * - totalCost is auto-computed as quantity × pricePerUnit if not supplied
 *
 * TODO: Integrate auth → set driverId from JWT for DRIVER role.
 * TODO: Integrate RBAC → allow ADMIN, MANAGER, DRIVER roles only.
 */
export async function POST(request: Request) {
    // 1. Parse body
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return Errors.invalidJson();
    }

    // 2. Zod validation
    const parsed = fuelCreateSchema.safeParse(payload);
    if (!parsed.success) {
        const flat = parsed.error.flatten();
        return errorResponse(
            "VALIDATION_ERROR",
            "Validation failed",
            422,
            flat.fieldErrors as Record<string, string[]>,
        );
    }

    const data = parsed.data;

    // 3. Business rule: filledAt cannot be in future (belt-and-suspenders, also in Zod)
    if (data.filledAt && data.filledAt > new Date()) {
        return Errors.futureDate("filledAt");
    }

    // 4. Verify FK targets exist
    const fkError = await validateFuelForeignKeys(data.vehicleId, data.driverId, data.tripId);
    if (fkError) return fkError;

    // 5. Persist
    try {
        const fuelLog = await prisma.fuelLog.create({
            data: buildFuelCreateData(data),
            include: {
                vehicle: { select: { id: true, registrationNo: true } },
                driver: { select: { id: true, user: { select: { name: true } } } },
            },
        });
        return createdResponse(fuelLog);
    } catch (error) {
        console.error("[fuel-logs:POST]", error);
        if (isUniqueConstraintError(error)) {
            return Errors.conflict("A fuel log with these details already exists");
        }
        if (isForeignKeyError(error)) {
            return Errors.conflict("Referenced vehicle, driver, or trip was not found");
        }
        return Errors.internal();
    }
}