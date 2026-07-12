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

const maintenanceUpdateSchema = maintenanceCreateSchema.partial().superRefine((value, context) => {
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

function buildMaintenanceWhere(url: URL) {
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");

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

function isPrismaNotFoundError(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, limit, skip } = parsePagination(url);
  const where = buildMaintenanceWhere(url);

  const [items, total] = await prisma.$transaction([
    prisma.maintenanceLog.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.maintenanceLog.count({ where }),
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

  const parsed = maintenanceCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const maintenanceLog = await prisma.maintenanceLog.create({ data: buildMaintenanceData(parsed.data) });
    return NextResponse.json(maintenanceLog, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: "Maintenance log already exists" }, { status: 409 });
    }

    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Referenced vehicle was not found" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create maintenance log" }, { status: 500 });
  }
}