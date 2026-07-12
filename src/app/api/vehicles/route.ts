import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

const vehicleCreateSchema = z.object({
  registrationNumber: z.string().trim().min(1),
  make: z.string().trim().min(1),
  model: z.string().trim().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  type: vehicleTypeSchema,
  fuelType: fuelTypeSchema,
  status: vehicleStatusSchema.optional(),
  odometerKm: z.coerce.number().int().min(0).optional(),
  seatingCapacity: z.coerce.number().int().positive().optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
  insurancePolicyNo: z.string().trim().min(1).optional().nullable(),
  insuranceExpiry: z.coerce.date().optional().nullable(),
  registrationExpiry: z.coerce.date().optional().nullable(),
  imageUrl: z.string().trim().min(1).optional().nullable(),
}).strict();

const vehicleUpdateSchema = vehicleCreateSchema.partial().superRefine((value, context) => {
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
    insurancePolicyNo: input.insurancePolicyNo ?? null,
    insuranceExpiry: input.insuranceExpiry ?? null,
    registrationExpiry: input.registrationExpiry ?? null,
    imageUrl: input.imageUrl ?? null,
  };
}

function buildVehicleWhere(url: URL) {
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");

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

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
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
  const where = buildVehicleWhere(url);

  const [items, total] = await prisma.$transaction([
    prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.vehicle.count({ where }),
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

  const parsed = vehicleCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const vehicle = await prisma.vehicle.create({ data: buildVehicleData(parsed.data) });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: "Vehicle registration number already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create vehicle" }, { status: 500 });
  }
}