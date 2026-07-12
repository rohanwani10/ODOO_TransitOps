import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const tripStatusSchema = z.enum(["DRAFT", "DISPATCHED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

const tripBaseSchema = z.object({
        vehicleId: z.string().trim().min(1),
        driverId: z.string().trim().min(1),
        origin: z.string().trim().min(1),
        destination: z.string().trim().min(1),
        scheduledStart: z.coerce.date(),
        scheduledEnd: z.coerce.date(),
        actualStart: z.coerce.date().optional().nullable(),
        actualEnd: z.coerce.date().optional().nullable(),
        startOdometer: z.coerce.number().int().min(0).optional().nullable(),
        endOdometer: z.coerce.number().int().min(0).optional().nullable(),
        distanceKm: z.coerce.number().int().min(0).optional().nullable(),
        cargoWeightKg: z.coerce.number().int().positive().optional().nullable(),
        purpose: z.string().trim().min(1).optional().nullable(),
        status: tripStatusSchema.optional(),
        notes: z.string().trim().min(1).optional().nullable(),
    }).strict();

const tripCreateSchema = tripBaseSchema
    .superRefine((value, context) => {
        if (value.scheduledEnd < value.scheduledStart) {
            context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "scheduledEnd must be after scheduledStart" });
        }

        if (value.actualStart && value.actualEnd && value.actualEnd < value.actualStart) {
            context.addIssue({ code: "custom", path: ["actualEnd"], message: "actualEnd must be after actualStart" });
        }
    });


function parsePagination(url: URL) {
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    };
}

function buildTripWhere(url: URL) {
    const q = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status")?.trim();

    const filters: Record<string, unknown>[] = [];

    if (q) {
        filters.push({
            OR: [
                { origin: { contains: q, mode: "insensitive" as const } },
                { destination: { contains: q, mode: "insensitive" as const } },
                { purpose: { contains: q, mode: "insensitive" as const } },
                { notes: { contains: q, mode: "insensitive" as const } },
                { vehicle: { registrationNo: { contains: q, mode: "insensitive" as const } } },
                { driver: { user: { name: { contains: q, mode: "insensitive" as const } } } },
            ],
        });
    }

    if (status && tripStatusSchema.safeParse(status).success) {
        filters.push({ status });
    }

    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0];
    return { AND: filters };
}

function buildTripData(input: z.infer<typeof tripCreateSchema>) {
    return {
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        origin: input.origin,
        destination: input.destination,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        actualStart: input.actualStart ?? null,
        actualEnd: input.actualEnd ?? null,
        startOdometer: input.startOdometer ?? null,
        endOdometer: input.endOdometer ?? null,
        distanceKm: input.distanceKm ?? null,
        cargoWeightKg: input.cargoWeightKg ?? null,
        purpose: input.purpose ?? null,
        status: input.status ?? "DRAFT",
        notes: input.notes ?? null,
    };
}

function isPrismaUniqueError(error: unknown) {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}



export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const { page, limit, skip } = parsePagination(url);
        const where = buildTripWhere(url);

        const [items, total] = await prisma.$transaction([
            prisma.trip.findMany({
                where,
                orderBy: { scheduledStart: "desc" },
                skip,
                take: limit,
                include: {
                    vehicle: {
                        select: { id: true, registrationNo: true, make: true, model: true, type: true, status: true },
                    },
                    driver: {
                        select: {
                            id: true,
                            licenseNo: true,
                            status: true,
                            user: { select: { id: true, name: true } },
                        },
                    },
                },
            }),
            prisma.trip.count({ where }),
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
        console.error("GET /api/trips error:", error);
        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch trips" } },
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

    const parsed = tripCreateSchema.safeParse(payload);

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

    try {
        const trip = await prisma.trip.create({
            data: buildTripData(parsed.data),
            include: {
                vehicle: {
                    select: { id: true, registrationNo: true, make: true, model: true },
                },
                driver: {
                    select: {
                        id: true,
                        licenseNo: true,
                        user: { select: { id: true, name: true } },
                    },
                },
            },
        });
        return NextResponse.json({ success: true, data: trip }, { status: 201 });
    } catch (error) {
        if (isPrismaUniqueError(error)) {
            return NextResponse.json(
                { success: false, error: { code: "DUPLICATE", message: "Trip already exists" } },
                { status: 409 },
            );
        }

        if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
            return NextResponse.json(
                { success: false, error: { code: "FK_VIOLATION", message: "Referenced vehicle or driver was not found" } },
                { status: 409 },
            );
        }

        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create trip" } },
            { status: 500 },
        );
    }
}