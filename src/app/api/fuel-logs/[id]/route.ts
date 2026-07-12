import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    noContentResponse,
    errorResponse,
    Errors,
    successResponse,
} from "@/lib/api-response";
import {
    isForeignKeyError,
    isNotFoundError,
    isUniqueConstraintError,
} from "@/lib/prisma-errors";

// ---------------------------------------------------------------------------
// Schema (mirrors create schema but all fields optional for PATCH)
// ---------------------------------------------------------------------------

const fuelTypeSchema = z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG"]);

const fuelUpdateSchema = z
    .object({
        vehicleId: z.string().trim().min(1).optional(),
        driverId: z.string().trim().min(1).optional(),
        tripId: z.string().trim().min(1).optional().nullable(),
        fuelType: fuelTypeSchema.optional(),
        quantity: z.coerce.number().positive("Liters must be greater than 0").optional(),
        pricePerUnit: z.coerce.number().positive("Price per unit must be greater than 0").optional(),
        totalCost: z.coerce.number().nonnegative("Total cost cannot be negative").optional(),
        odometerKm: z.coerce.number().int().nonnegative("Odometer cannot be negative").optional(),
        station: z.string().trim().min(1).optional().nullable(),
        filledAt: z.coerce.date().optional().nullable(),
    })
    .strict()
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
// Helper: build partial update data
// ---------------------------------------------------------------------------

function buildUpdateData(input: z.infer<typeof fuelUpdateSchema>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId;
    if (input.driverId !== undefined) data.driverId = input.driverId;
    if (input.tripId !== undefined) data.tripId = input.tripId;
    if (input.fuelType !== undefined) data.fuelType = input.fuelType;
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.pricePerUnit !== undefined) data.pricePerUnit = input.pricePerUnit;
    if (input.odometerKm !== undefined) data.odometerKm = input.odometerKm;
    if (input.station !== undefined) data.station = input.station;
    if (input.filledAt !== undefined) data.filledAt = input.filledAt;

    // Re-compute totalCost if quantity or pricePerUnit changed but totalCost not explicitly set
    if (
        input.totalCost !== undefined
    ) {
        data.totalCost = input.totalCost;
    } else if (data.quantity !== undefined && data.pricePerUnit !== undefined) {
        data.totalCost = parseFloat(
            (Number(data.quantity) * Number(data.pricePerUnit)).toFixed(2),
        );
    }

    return data;
}

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/fuel-logs/[id]
// ---------------------------------------------------------------------------

/**
 * Retrieves a single fuel log with related vehicle, driver, and trip info.
 *
 * TODO: Integrate auth → DRIVER can only fetch their own log.
 */
export async function GET(_request: Request, context: RouteContext) {
    const { id } = await context.params;

    try {
        const fuelLog = await prisma.fuelLog.findUnique({
            where: { id },
            include: {
                vehicle: { select: { id: true, registrationNo: true, make: true, model: true } },
                driver: { select: { id: true, user: { select: { name: true, email: true } } } },
                trip: {
                    select: {
                        id: true,
                        origin: true,
                        destination: true,
                        status: true,
                        scheduledStart: true,
                    },
                },
            },
        });

        if (!fuelLog) return Errors.notFound("Fuel log");
        return successResponse(fuelLog);
    } catch (error) {
        console.error("[fuel-logs/[id]:GET]", error);
        return Errors.internal();
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/fuel-logs/[id]
// ---------------------------------------------------------------------------

/**
 * Partially updates a fuel log.
 *
 * Validation rules:
 * - At least one field required
 * - quantity > 0 if provided
 * - pricePerUnit > 0 if provided
 * - odometerKm >= 0 if provided
 * - filledAt not in future if provided
 * - totalCost auto-recomputed if quantity/pricePerUnit changed
 *
 * TODO: Integrate RBAC → ADMIN and MANAGER only.
 */
export async function PATCH(request: Request, context: RouteContext) {
    const { id } = await context.params;

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return Errors.invalidJson();
    }

    const parsed = fuelUpdateSchema.safeParse(payload);
    if (!parsed.success) {
        const flat = parsed.error.flatten();
        return errorResponse(
            "VALIDATION_ERROR",
            "Validation failed",
            422,
            flat.fieldErrors as Record<string, string[]>,
        );
    }

    // Business rule: filledAt not in future
    if (parsed.data.filledAt && parsed.data.filledAt > new Date()) {
        return Errors.futureDate("filledAt");
    }

    try {
        const updated = await prisma.fuelLog.update({
            where: { id },
            data: buildUpdateData(parsed.data),
            include: {
                vehicle: { select: { id: true, registrationNo: true } },
                driver: { select: { id: true, user: { select: { name: true } } } },
            },
        });
        return successResponse(updated);
    } catch (error) {
        console.error("[fuel-logs/[id]:PATCH]", error);
        if (isNotFoundError(error)) return Errors.notFound("Fuel log");
        if (isUniqueConstraintError(error)) return Errors.conflict("Fuel log already exists with these details");
        if (isForeignKeyError(error)) return Errors.conflict("Referenced vehicle, driver, or trip was not found");
        return Errors.internal();
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/fuel-logs/[id]
// ---------------------------------------------------------------------------

/**
 * Deletes a fuel log (hard delete — no soft delete on fuel logs).
 *
 * TODO: Integrate RBAC → ADMIN only.
 */
export async function DELETE(_request: Request, context: RouteContext) {
    const { id } = await context.params;

    try {
        await prisma.fuelLog.delete({ where: { id } });
        return noContentResponse();
    } catch (error) {
        console.error("[fuel-logs/[id]:DELETE]", error);
        if (isNotFoundError(error)) return Errors.notFound("Fuel log");
        return Errors.internal();
    }
}