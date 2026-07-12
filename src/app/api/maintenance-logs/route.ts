import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const maintenanceTypeSchema = z.enum(["SCHEDULED", "UNSCHEDULED", "EMERGENCY"]);
const maintenanceStatusSchema = z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

const maintenanceCreateSchema = z.object({
    vehicleId: z.string().trim().min(1),
    type: maintenanceTypeSchema,
    status: maintenanceStatusSchema.optional(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional().nullable(),
    vendor: z.string().trim().min(1).optional().nullable(),
    odometerKm: z.coerce.number().int().min(0).optional().nullable(),
    scheduledAt: z.coerce.date(),
    completedAt: z.coerce.date().optional().nullable(),
    cost: z.coerce.number().positive().optional().nullable(),
}).strict();



function parsePagination(url: URL) {
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    };
}

function buildMaintenanceWhere(url: URL) {
    const q = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status");
    const vehicleId = url.searchParams.get("vehicleId")?.trim();

    const filters: Record<string, unknown>[] = [];

    if (q) {
        filters.push({
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { vendor: { contains: q, mode: "insensitive" } },
                { vehicle: { registrationNo: { contains: q, mode: "insensitive" } } },
            ],
        });
    }

    if (status && maintenanceStatusSchema.safeParse(status).success) {
        filters.push({ status });
    }

    if (vehicleId) {
        filters.push({ vehicleId });
    }

    if (filters.length === 0) {
        return undefined;
    }

    if (filters.length === 1) {
        return filters[0];
    }

    return { AND: filters };
}

function buildMaintenanceData(input: z.infer<typeof maintenanceCreateSchema>) {
    return {
        vehicleId: input.vehicleId,
        type: input.type,
        status: input.status ?? "SCHEDULED",
        title: input.title,
        description: input.description ?? null,
        vendor: input.vendor ?? null,
        odometerKm: input.odometerKm ?? null,
        scheduledAt: input.scheduledAt,
        completedAt: input.completedAt ?? null,
        cost: input.cost ?? null,
    };
}

function isPrismaUniqueError(error: unknown) {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}



export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const { page, limit, skip } = parsePagination(url);
        const where = buildMaintenanceWhere(url);

        const [items, total] = await prisma.$transaction([
            prisma.maintenanceLog.findMany({
                where,
                orderBy: { scheduledAt: "desc" },
                skip,
                take: limit,
                include: {
                    vehicle: {
                        select: { id: true, registrationNo: true, make: true, model: true, type: true, status: true },
                    },
                },
            }),
            prisma.maintenanceLog.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: items,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("GET /api/maintenance-logs error:", error);
        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch maintenance logs" } },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
            { status: 400 },
        );
    }

    const parsed = maintenanceCreateSchema.safeParse(payload);

    if (!parsed.success) {
        const flat = parsed.error.flatten();
        const fields: Record<string, string> = {};
        for (const [key, messages] of Object.entries(flat.fieldErrors)) {
            if (messages && messages.length > 0) {
                fields[key] = messages[0];
            }
        }
        return NextResponse.json(
            { success: false, error: { code: "VALIDATION_ERROR", message: "Validation failed", fields } },
            { status: 422 },
        );
    }

    // Business rule: vehicle must not be ON_TRIP
    const vehicle = await prisma.vehicle.findUnique({
        where: { id: parsed.data.vehicleId },
        select: { id: true, status: true },
    });

    if (!vehicle) {
        return NextResponse.json(
            { success: false, error: { code: "NOT_FOUND", message: "Vehicle not found" } },
            { status: 404 },
        );
    }

    if (vehicle.status === "ON_TRIP") {
        return NextResponse.json(
            { success: false, error: { code: "INVALID_STATE", message: "Cannot start maintenance while vehicle is on an active trip" } },
            { status: 409 },
        );
    }

    try {
        // Create maintenance log and set vehicle to MAINTENANCE status in a transaction
        const maintenanceLog = await prisma.$transaction(async (tx) => {
            const log = await tx.maintenanceLog.create({
                data: buildMaintenanceData(parsed.data),
                include: {
                    vehicle: {
                        select: { id: true, registrationNo: true, make: true, model: true },
                    },
                },
            });

            // SRS Business Rule: Creating active maintenance → vehicle status = MAINTENANCE (In Shop)
            if (parsed.data.status !== "COMPLETED" && parsed.data.status !== "CANCELLED") {
                await tx.vehicle.update({
                    where: { id: parsed.data.vehicleId },
                    data: { status: "MAINTENANCE" },
                });
            }

            return log;
        });

        return NextResponse.json({ success: true, data: maintenanceLog }, { status: 201 });
    } catch (error) {
        if (isPrismaUniqueError(error)) {
            return NextResponse.json(
                { success: false, error: { code: "DUPLICATE", message: "Maintenance log already exists" } },
                { status: 409 },
            );
        }

        if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
            return NextResponse.json(
                { success: false, error: { code: "FK_VIOLATION", message: "Referenced vehicle was not found" } },
                { status: 409 },
            );
        }

        console.error("POST /api/maintenance-logs error:", error);
        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create maintenance log" } },
            { status: 500 },
        );
    }
}