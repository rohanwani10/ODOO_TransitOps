import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const vehicleStatusSchema = z.enum([
    "AVAILABLE",
    "ON_TRIP",
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

const vehicleCreateSchema = z.object({
    registrationNumber: z
        .string()
        .trim()
        .min(1, "Registration number is required")
        .max(30, "Registration number must be at most 30 characters")
        .regex(
            /^[A-Za-z0-9\-\s]+$/,
            "Registration number must be alphanumeric (hyphens and spaces allowed)"
        ),
    make: z.string().trim().min(1, "Make is required"),
    model: z.string().trim().min(1, "Model is required"),
    year: z.coerce
        .number()
        .int()
        .min(1900, "Year must be 1900 or later")
        .max(new Date().getFullYear() + 1, "Year cannot be in the far future"),
    type: vehicleTypeSchema,
    fuelType: fuelTypeSchema,
    status: vehicleStatusSchema.optional(),
    odometerKm: z.coerce
        .number()
        .int()
        .min(0, "Odometer cannot be negative")
        .optional(),
    seatingCapacity: z.coerce
        .number()
        .int()
        .positive("Seating capacity must be a positive number")
        .optional()
        .nullable(),
    payloadCapacityKg: z.coerce
        .number()
        .int()
        .positive("Payload capacity must be greater than 0")
        .optional()
        .nullable(),
    insurancePolicyNo: z.string().trim().min(1).optional().nullable(),
    insuranceExpiry: z.coerce.date().optional().nullable(),
    registrationExpiry: z.coerce.date().optional().nullable(),
    imageUrl: z.string().trim().min(1).optional().nullable(),
}).strict();



function parsePagination(url: URL) {
    const page = Math.max(
        1,
        Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1
    );
    const limit = Math.min(
        100,
        Math.max(
            1,
            Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10
        )
    );

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    };
}

const ALLOWED_SORT_FIELDS = [
    "registrationNo",
    "make",
    "model",
    "year",
    "type",
    "fuelType",
    "status",
    "odometerKm",
    "payloadCapacityKg",
    "seatingCapacity",
    "createdAt",
    "updatedAt",
] as const;

type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

function parseSorting(url: URL): { orderBy: Record<string, "asc" | "desc"> } {
    const sortBy = url.searchParams.get("sortBy") as SortField | null;
    const sortOrder = url.searchParams.get("sortOrder")?.toLowerCase();

    if (sortBy && ALLOWED_SORT_FIELDS.includes(sortBy)) {
        return {
            orderBy: { [sortBy]: sortOrder === "asc" ? "asc" : "desc" },
        };
    }

    return { orderBy: { createdAt: "desc" } };
}

function buildVehicleData(input: z.infer<typeof vehicleCreateSchema>) {
    return {
        registrationNo: input.registrationNumber,
        make: input.make,
        model: input.model,
        year: input.year,
        type: input.type,
        fuelType: input.fuelType,
        status: input.status ?? "AVAILABLE",
        odometerKm: input.odometerKm ?? 0,
        seatingCapacity: input.seatingCapacity ?? null,
        payloadCapacityKg: input.payloadCapacityKg ?? null,
        insurancePolicyNo: input.insurancePolicyNo ?? null,
        insuranceExpiry: input.insuranceExpiry ?? null,
        registrationExpiry: input.registrationExpiry ?? null,
        imageUrl: input.imageUrl ?? null,
    };
}

function buildVehicleWhere(url: URL) {
    const q = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const fuelType = url.searchParams.get("fuelType");

    const filters: Record<string, unknown>[] = [];

    if (q) {
        filters.push({
            OR: [
                { registrationNo: { contains: q, mode: "insensitive" } },
                { make: { contains: q, mode: "insensitive" } },
                { model: { contains: q, mode: "insensitive" } },
            ],
        });
    }

    if (status && vehicleStatusSchema.safeParse(status).success) {
        filters.push({ status });
    }

    if (type && vehicleTypeSchema.safeParse(type).success) {
        filters.push({ type });
    }

    if (fuelType && fuelTypeSchema.safeParse(fuelType).success) {
        filters.push({ fuelType });
    }

    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0];
    return { AND: filters };
}

function isPrismaUniqueError(error: unknown) {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
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
// GET /api/vehicles — List vehicles (with filters, search, sort, pagination)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const { page, limit, skip } = parsePagination(url);
        const { orderBy } = parseSorting(url);
        const where = buildVehicleWhere(url);

        const [items, total] = await prisma.$transaction([
            prisma.vehicle.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
            prisma.vehicle.count({ where }),
        ]);

        return successResponse(items, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("GET /api/vehicles error:", error);
        return errorResponse(
            "INTERNAL_ERROR",
            "Failed to fetch vehicles",
            500
        );
    }
}

// ---------------------------------------------------------------------------
// POST /api/vehicles — Create a new vehicle
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const parsed = vehicleCreateSchema.safeParse(payload);

    if (!parsed.success) {
        const flat = parsed.error.flatten();
        // Build field-level error map
        const fields: Record<string, string> = {};
        for (const [key, messages] of Object.entries(flat.fieldErrors)) {
            if (messages && messages.length > 0) {
                fields[key] = messages[0];
            }
        }

        return errorResponse(
            "VALIDATION_ERROR",
            "Validation failed",
            422,
            fields
        );
    }

    try {
        const vehicle = await prisma.vehicle.create({
            data: buildVehicleData(parsed.data),
        });
        return successResponse(vehicle, undefined, 201);
    } catch (error) {
        if (isPrismaUniqueError(error)) {
            return errorResponse(
                "DUPLICATE_REGISTRATION",
                "Registration number already exists",
                409
            );
        }

        return errorResponse(
            "INTERNAL_ERROR",
            "Failed to create vehicle",
            500
        );
    }
}