import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const tripStatusSchema = z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

const tripCreateSchema = z
  .object({
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
    cargoWeight: z.coerce.number().positive().optional().nullable(),
    purpose: z.string().trim().min(1).optional().nullable(),
    status: tripStatusSchema.optional(),
    notes: z.string().trim().min(1).optional().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scheduledEnd < value.scheduledStart) {
      context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "scheduledEnd must be after scheduledStart" });
    }

    if (value.actualStart && value.actualEnd && value.actualEnd < value.actualStart) {
      context.addIssue({ code: "custom", path: ["actualEnd"], message: "actualEnd must be after actualStart" });
    }
  });

const tripUpdateSchema = tripCreateSchema.partial().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: "custom", message: "At least one field is required" });
  }

  if (value.scheduledStart && value.scheduledEnd && value.scheduledEnd < value.scheduledStart) {
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

  if (!q) {
    return undefined;
  }

  return {
    OR: [
      { origin: { contains: q, mode: "insensitive" as const } },
      { destination: { contains: q, mode: "insensitive" as const } },
      { purpose: { contains: q, mode: "insensitive" as const } },
      { notes: { contains: q, mode: "insensitive" as const } },
      { vehicle: { registrationNo: { contains: q, mode: "insensitive" as const } } },
      { driver: { licenseNo: { contains: q, mode: "insensitive" as const } } },
    ],
  };
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
    purpose: input.purpose ?? null,
    status: input.status ?? "SCHEDULED",
    notes: input.notes ?? null,
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
  const where = buildTripWhere(url);

  const [items, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      orderBy: { scheduledStart: "desc" },
      skip,
      take: limit,
    }),
    prisma.trip.count({ where }),
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

  const parsed = tripCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const trip = await prisma.trip.create({ data: buildTripData(parsed.data) });
    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: "Trip already exists" }, { status: 409 });
    }

    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Referenced vehicle or driver was not found" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create trip" }, { status: 500 });
  }
}