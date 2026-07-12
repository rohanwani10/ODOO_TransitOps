import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const driverStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

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

const driverUpdateSchema = driverCreateSchema.partial().superRefine((value, context) => {
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
        status: input.status ?? "ACTIVE",
        emergencyName: input.emergencyName ?? null,
        emergencyPhone: input.emergencyPhone ?? null,
        imageUrl: input.imageUrl ?? null,
        hiredAt: input.hiredAt,
    };
}

function buildDriverWhere(url: URL) {
    const q = url.searchParams.get("q")?.trim();

    if (!q) {
        return undefined;
    }

    return {
        OR: [
            { licenseNo: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
        ],
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
    const where = buildDriverWhere(url);

    const [items, total] = await prisma.$transaction([
        prisma.driver.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.driver.count({ where }),
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

    const parsed = driverCreateSchema.safeParse(payload);

    if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const licenseNo = buildDriverLicense(parsed.data);

    if (!licenseNo) {
        return NextResponse.json({ error: "License number is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    try {
        const driver = await prisma.driver.create({
            data: buildDriverData({
                ...parsed.data,
                licenseNumber: licenseNo,
            }),
        });

        return NextResponse.json(driver, { status: 201 });
    } catch (error) {
        if (isPrismaUniqueError(error)) {
            return NextResponse.json({ error: "Driver license number or user already exists" }, { status: 409 });
        }

        return NextResponse.json({ error: "Failed to create driver" }, { status: 500 });
    }
}