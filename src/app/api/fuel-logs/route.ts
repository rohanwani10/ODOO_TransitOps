import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const fuelTypeSchema = z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG"]);

const fuelCreateSchema = z.object({
    vehicleId: z.string().trim().min(1),
    driverId: z.string().trim().min(1),
    tripId: z.string().trim().min(1).optional().nullable(),
    fuelType: fuelTypeSchema,
    quantity: z.coerce.number().positive(),
    pricePerUnit: z.coerce.number().positive(),
    totalCost: z.coerce.number().positive().optional(),
    odometerKm: z.coerce.number().int().min(0),
    station: z.string().trim().min(1).optional().nullable(),
    filledAt: z.coerce.date().optional(),
}).strict();

const fuelUpdateSchema = fuelCreateSchema.partial().superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
        context.addIssue({ code: "custom", message: "At least one field is required" });
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

function buildFuelWhere(url: URL) {
    const q = url.searchParams.get("q")?.trim();

    if (!q) {
        return undefined;
    }

    return {
        OR: [
            { station: { contains: q, mode: "insensitive" as const } },
            { vehicle: { registrationNo: { contains: q, mode: "insensitive" as const } } },
            { driver: { licenseNo: { contains: q, mode: "insensitive" as const } } },
        ],
    };
}

function buildFuelData(input: z.infer<typeof fuelCreateSchema>) {
    return {
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        tripId: input.tripId ?? null,
        fuelType: input.fuelType,
        quantity: input.quantity,
        pricePerUnit: input.pricePerUnit,
        totalCost: input.totalCost ?? Number((input.quantity * input.pricePerUnit).toFixed(2)),
        odometerKm: input.odometerKm,
        station: input.station ?? null,
        filledAt: input.filledAt ?? new Date(),
    };
}

function isPrismaUniqueError(error: unknown) {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}

function isPrismaNotFoundError(error: unknown) {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025";
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const where = buildFuelWhere(url);

    const [items, total] = await prisma.$transaction([
        prisma.fuelLog.findMany({
            where,
            orderBy: { filledAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.fuelLog.count({ where }),
    ]);

    return NextResponse.json({
        data: items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    });
}

export async function POST(request: Request) {
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = fuelCreateSchema.safeParse(payload);

    if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    try {
        const fuelLog = await prisma.fuelLog.create({ data: buildFuelData(parsed.data) });
        return NextResponse.json(fuelLog, { status: 201 });
    } catch (error) {
        if (isPrismaUniqueError(error)) {
            return NextResponse.json({ error: "Fuel log already exists" }, { status: 409 });
        }

        if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
            return NextResponse.json({ error: "Referenced vehicle, driver, or trip was not found" }, { status: 409 });
        }

        return NextResponse.json({ error: "Failed to create fuel log" }, { status: 500 });
    }
}