import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const driverStatusSchema = z.enum(["AVAILABLE", "ON_TRIP", "ACTIVE", "INACTIVE", "SUSPENDED"]);

const driverCreateSchema = z.object({
    userId: z.string().trim().min(1),
    licenseNumber: z.string().trim().min(1).optional(),
    licenseNo: z.string().trim().min(1).optional(),
    licenseExpiry: z.coerce.date(),
    phone: z.string().trim().min(1),
    address: z.string().trim().min(1).optional().nullable(),
    dateOfBirth: z.coerce.date().optional().nullable(),
    status: driverStatusSchema.optional(),
    emergencyName: z.string().trim().min(1).optional().nullable(),
    emergencyPhone: z.string().trim().min(1).optional().nullable(),
    imageUrl: z.string().trim().min(1).optional().nullable(),
    hiredAt: z.coerce.date().optional(),
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

function buildDriverLicense(input: z.infer<typeof driverCreateSchema>) {
    return input.licenseNumber ?? input.licenseNo;
}

function buildDriverData(input: z.infer<typeof driverCreateSchema>) {
    const licenseNo = buildDriverLicense(input);

    if (!licenseNo) {
        throw new Error("LICENSE_NUMBER_REQUIRED");
    }

    return {
        userId: input.userId,
        licenseNo,
        licenseExpiry: input.licenseExpiry,
        phone: input.phone,
        address: input.address ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        status: input.status ?? "AVAILABLE",
        emergencyName: input.emergencyName ?? null,
        emergencyPhone: input.emergencyPhone ?? null,
        imageUrl: input.imageUrl ?? null,
        hiredAt: input.hiredAt,
    };
}

function buildDriverWhere(url: URL) {
    const q = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status")?.trim();

    const filters: Record<string, unknown>[] = [];

    if (q) {
        filters.push({
            OR: [
                { licenseNo: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q, mode: "insensitive" as const } },
                { user: { name: { contains: q, mode: "insensitive" as const } } },
                { user: { email: { contains: q, mode: "insensitive" as const } } },
            ],
        });
    }

    if (status && driverStatusSchema.safeParse(status).success) {
        filters.push({ status });
    }

    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0];
    return { AND: filters };
}

function isPrismaUniqueError(error: unknown) {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const { page, limit, skip } = parsePagination(url);
        const where = buildDriverWhere(url);

        const [items, total] = await prisma.$transaction([
            prisma.driver.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    user: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
            }),
            prisma.driver.count({ where }),
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
        console.error("GET /api/drivers error:", error);
        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch drivers" } },
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

    const parsed = driverCreateSchema.safeParse(payload);

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

    const licenseNo = buildDriverLicense(parsed.data);

    if (!licenseNo) {
        return NextResponse.json(
            { success: false, error: { code: "VALIDATION_ERROR", message: "License number is required" } },
            { status: 422 },
        );
    }

    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });

    if (!user) {
        return NextResponse.json(
            { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
            { status: 404 },
        );
    }

    try {
        const driver = await prisma.driver.create({
            data: buildDriverData({
                ...parsed.data,
                licenseNumber: licenseNo,
            }),
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });

        return NextResponse.json({ success: true, data: driver }, { status: 201 });
    } catch (error) {
        if (isPrismaUniqueError(error)) {
            return NextResponse.json(
                { success: false, error: { code: "DUPLICATE", message: "Driver license number or user already exists" } },
                { status: 409 },
            );
        }

        return NextResponse.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create driver" } },
            { status: 500 },
        );
    }
}
