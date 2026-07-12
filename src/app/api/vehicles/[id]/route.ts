import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const vehicleStatusSchema = z.enum([
    "AVAILABLE",
    "IN_USE",
    "MAINTENANCE",
    "OUT_OF_SERVICE",
    "RETIRED",
]);

const vehicleTypeSchema = z.enum([
    "BUS",
    "MINIBUS",
    "VAN",
    "TRUCK",
    "CAR",
    "MOTORCYCLE",
]);

const fuelTypeSchema = z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG"]);

const vehicleUpdateSchema = z
    .object({
        registrationNumber: z
            .string()
            .trim()
            .min(1, "Registration number is required")
            .max(30, "Registration number must be at most 30 characters")
            .regex(
                /^[A-Za-z0-9\-\s]+$/,
                "Registration number must be alphanumeric (hyphens and spaces allowed)"
            )
            .optional(),
        make: z.string().trim().min(1, "Make is required").optional(),
        model: z.string().trim().min(1, "Model is required").optional(),
        year: z.coerce
            .number()
            .int()
            .min(1900)
            .max(new Date().getFullYear() + 1)
            .optional(),
        type: vehicleTypeSchema.optional(),
        fuelType: fuelTypeSchema.optional(),
        status: vehicleStatusSchema.optional(),
        maxLoadCapacityKg: z.coerce
            .number()
            .positive("Max load capacity must be greater than 0")
            .optional()
            .nullable(),
        odometerKm: z.coerce
            .number()
            .int()
            .min(0, "Odometer cannot be negative")
            .optional(),
        seatingCapacity: z.coerce
            .number()
            .int()
            .positive()
            .optional()
            .nullable(),
        acquisitionCost: z.coerce
            .number()
            .min(0, "Acquisition cost cannot be negative")
            .optional()
            .nullable(),
        region: z.string().trim().max(80).optional().nullable(),
        insurancePolicyNo: z.string().trim().min(1).optional().nullable(),
        insuranceExpiry: z.coerce.date().optional().nullable(),
        registrationExpiry: z.coerce.date().optional().nullable(),
        imageUrl: z.string().trim().min(1).optional().nullable(),
    })
    .strict();

// ---------------------------------------------------------------------------
// System-controlled statuses that cannot be set manually via PATCH
// These are only changed by Trip and Maintenance modules (BR-6..10)
// ---------------------------------------------------------------------------

const SYSTEM_CONTROLLED_STATUSES = ["IN_USE"] as const;

// Valid manual status transitions allowed per SRS §11.1
// (User can only manually set AVAILABLE → RETIRED or RETIRED → AVAILABLE)
const VALID_MANUAL_TRANSITIONS: Record<string, string[]> = {
    AVAILABLE: ["RETIRED", "OUT_OF_SERVICE"],
    OUT_OF_SERVICE: ["AVAILABLE", "RETIRED"],
    RETIRED: ["AVAILABLE"], // un-retire by Fleet Manager
    // IN_USE and MAINTENANCE are system-controlled:
    // IN_USE → AVAILABLE happens when trip completes/cancels
    // MAINTENANCE → AVAILABLE happens when maintenance closes
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVehicleData(input: z.infer<typeof vehicleUpdateSchema>) {
    const data: Record<string, unknown> = {};

    if (input.registrationNumber !== undefined)
        data.registrationNo = input.registrationNumber;
    if (input.make !== undefined) data.make = input.make;
    if (input.model !== undefined) data.model = input.model;
    if (input.year !== undefined) data.year = input.year;
    if (input.type !== undefined) data.type = input.type;
    if (input.fuelType !== undefined) data.fuelType = input.fuelType;
    if (input.status !== undefined) data.status = input.status;
    if (input.maxLoadCapacityKg !== undefined)
        data.maxLoadCapacityKg = input.maxLoadCapacityKg;
    if (input.odometerKm !== undefined) data.odometerKm = input.odometerKm;
    if (input.seatingCapacity !== undefined)
        data.seatingCapacity = input.seatingCapacity;
    if (input.acquisitionCost !== undefined)
        data.acquisitionCost = input.acquisitionCost;
    if (input.region !== undefined) data.region = input.region;
    if (input.insurancePolicyNo !== undefined)
        data.insurancePolicyNo = input.insurancePolicyNo;
    if (input.insuranceExpiry !== undefined)
        data.insuranceExpiry = input.insuranceExpiry;
    if (input.registrationExpiry !== undefined)
        data.registrationExpiry = input.registrationExpiry;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;

    return data;
}

function isPrismaUniqueError(error: unknown) {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
    );
}

function isPrismaNotFoundError(error: unknown) {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "P2025"
    );
}

/** Standard success response envelope per SRS §7 */
function successResponse(
    data: unknown,
    meta?: Record<string, unknown>,
    status = 200
) {
    return NextResponse.json(
        { success: true, data, ...(meta ? { meta } : {}) },
        { status }
    );
}

/** Standard error response envelope per SRS §7 */
function errorResponse(
    code: string,
    message: string,
    status: number,
    fields?: Record<string, string>
) {
    return NextResponse.json(
        {
            success: false,
            error: { code, message, ...(fields ? { fields } : {}) },
        },
        { status }
    );
}

// ---------------------------------------------------------------------------
// GET /api/vehicles/:id — Get single vehicle
// ---------------------------------------------------------------------------

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    try {
        const vehicle = await prisma.vehicle.findFirst({
            where: { id, deletedAt: null },
            include: {
                _count: {
                    select: {
                        trips: true,
                        maintenanceLogs: true,
                        fuelLogs: true,
                        expenses: true,
                    },
                },
            },
        });

        if (!vehicle) {
            return errorResponse("NOT_FOUND", "Vehicle not found", 404);
        }

        return successResponse(vehicle);
    } catch {
        return errorResponse(
            "INTERNAL_ERROR",
            "Failed to fetch vehicle",
            500
        );
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/vehicles/:id — Update vehicle (with business rules)
// ---------------------------------------------------------------------------

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const parsed = vehicleUpdateSchema.safeParse(payload);

    if (!parsed.success) {
        const flat = parsed.error.flatten();
        const fields: Record<string, string> = {};
        for (const [key, messages] of Object.entries(flat.fieldErrors)) {
            if (messages && messages.length > 0) {
                fields[key] = messages[0];
            }
        }
        return errorResponse("VALIDATION_ERROR", "Validation failed", 422, fields);
    }

    if (Object.keys(parsed.data).length === 0) {
        return errorResponse(
            "VALIDATION_ERROR",
            "At least one field is required",
            422
        );
    }

    // ── Fetch current vehicle ──
    const existing = await prisma.vehicle.findFirst({
        where: { id, deletedAt: null },
    });

    if (!existing) {
        return errorResponse("NOT_FOUND", "Vehicle not found", 404);
    }

    // ── Business Rule: Retired vehicles are immutable except un-retiring ──
    if (existing.status === "RETIRED") {
        const onlyStatusChange =
            Object.keys(parsed.data).length === 1 &&
            parsed.data.status !== undefined;

        if (!onlyStatusChange || parsed.data.status !== "AVAILABLE") {
            return errorResponse(
                "VEHICLE_RETIRED",
                "Retired vehicles cannot be modified. Un-retire the vehicle first by setting status to AVAILABLE.",
                409
            );
        }
    }

    // ── Business Rule: Status transition validation ──
    if (parsed.data.status && parsed.data.status !== existing.status) {
        const requestedStatus = parsed.data.status;

        // Block setting system-controlled statuses manually
        if (
            SYSTEM_CONTROLLED_STATUSES.includes(
                requestedStatus as (typeof SYSTEM_CONTROLLED_STATUSES)[number]
            )
        ) {
            return errorResponse(
                "INVALID_STATUS_TRANSITION",
                `Status '${requestedStatus}' is system-controlled and cannot be set manually. It is set automatically when a trip is dispatched.`,
                409
            );
        }

        // Validate allowed transitions
        const allowed = VALID_MANUAL_TRANSITIONS[existing.status];
        if (!allowed || !allowed.includes(requestedStatus)) {
            return errorResponse(
                "INVALID_STATUS_TRANSITION",
                `Cannot transition vehicle from '${existing.status}' to '${requestedStatus}'.`,
                409
            );
        }
    }

    // ── Business Rule: Cannot edit certain fields while On Trip or In Maintenance ──
    if (
        existing.status === "IN_USE" &&
        parsed.data.status === undefined
    ) {
        // Allow only odometer update while on trip
        const editableWhileInUse = ["odometerKm"];
        const attemptedFields = Object.keys(parsed.data);
        const disallowed = attemptedFields.filter(
            (f) => !editableWhileInUse.includes(f)
        );
        if (disallowed.length > 0) {
            return errorResponse(
                "VEHICLE_IN_USE",
                `Vehicle is currently on a trip. Only odometer can be updated. Cannot modify: ${disallowed.join(", ")}`,
                409
            );
        }
    }

    try {
        const vehicle = await prisma.vehicle.update({
            where: { id },
            data: buildVehicleData(parsed.data),
        });

        return successResponse(vehicle);
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return errorResponse("NOT_FOUND", "Vehicle not found", 404);
        }

        if (isPrismaUniqueError(error)) {
            return errorResponse(
                "DUPLICATE_REGISTRATION",
                "Registration number already exists",
                409
            );
        }

        return errorResponse(
            "INTERNAL_ERROR",
            "Failed to update vehicle",
            500
        );
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/vehicles/:id — Soft delete (retire) vehicle
// ---------------------------------------------------------------------------

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    const existing = await prisma.vehicle.findFirst({
        where: { id, deletedAt: null },
    });

    if (!existing) {
        return errorResponse("NOT_FOUND", "Vehicle not found", 404);
    }

    // Business Rule: Cannot delete a vehicle that is currently on a trip
    if (existing.status === "IN_USE") {
        return errorResponse(
            "VEHICLE_IN_USE",
            "Cannot delete a vehicle that is currently on an active trip. Complete or cancel the trip first.",
            409
        );
    }

    // Business Rule: Cannot delete a vehicle currently in maintenance
    if (existing.status === "MAINTENANCE") {
        return errorResponse(
            "VEHICLE_IN_MAINTENANCE",
            "Cannot delete a vehicle that is currently in maintenance. Close the maintenance record first.",
            409
        );
    }

    // Check for active trips referencing this vehicle
    const activeTrips = await prisma.trip.count({
        where: {
            vehicleId: id,
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
    });

    if (activeTrips > 0) {
        return errorResponse(
            "VEHICLE_HAS_ACTIVE_TRIPS",
            `Vehicle has ${activeTrips} active trip(s). Cancel or complete them before deleting.`,
            409
        );
    }

    try {
        // Soft delete: set deletedAt timestamp and retire the vehicle
        const vehicle = await prisma.vehicle.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                status: "RETIRED",
            },
        });

        return successResponse(vehicle);
    } catch {
        return errorResponse(
            "INTERNAL_ERROR",
            "Failed to delete vehicle",
            500
        );
    }
}