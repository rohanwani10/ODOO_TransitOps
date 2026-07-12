import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const fuelTypeSchema = z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG"]);

const fuelUpdateSchema = z.object({
  vehicleId: z.string().trim().min(1).optional(),
  driverId: z.string().trim().min(1).optional(),
  tripId: z.string().trim().min(1).optional().nullable(),
  fuelType: fuelTypeSchema.optional(),
  quantity: z.coerce.number().positive().optional(),
  pricePerUnit: z.coerce.number().positive().optional(),
  totalCost: z.coerce.number().positive().optional(),
  odometerKm: z.coerce.number().int().min(0).optional(),
  station: z.string().trim().min(1).optional().nullable(),
  filledAt: z.coerce.date().optional(),
}).strict();

function buildFuelData(input: z.infer<typeof fuelUpdateSchema>) {
  const data: Record<string, unknown> = {};

  if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId;
  if (input.driverId !== undefined) data.driverId = input.driverId;
  if (input.tripId !== undefined) data.tripId = input.tripId;
  if (input.fuelType !== undefined) data.fuelType = input.fuelType;
  if (input.quantity !== undefined) data.quantity = input.quantity;
  if (input.pricePerUnit !== undefined) data.pricePerUnit = input.pricePerUnit;
  if (input.totalCost !== undefined) data.totalCost = input.totalCost;
  if (input.odometerKm !== undefined) data.odometerKm = input.odometerKm;
  if (input.station !== undefined) data.station = input.station;
  if (input.filledAt !== undefined) data.filledAt = input.filledAt;

  if (data.quantity !== undefined && data.pricePerUnit !== undefined && data.totalCost === undefined) {
    data.totalCost = Number((Number(data.quantity) * Number(data.pricePerUnit)).toFixed(2));
  }

  return data;
}

function isPrismaUniqueError(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}

function isPrismaNotFoundError(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const fuelLog = await prisma.fuelLog.findUnique({ where: { id } });

  if (!fuelLog) {
    return NextResponse.json({ error: "Fuel log not found" }, { status: 404 });
  }

  return NextResponse.json(fuelLog);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = fuelUpdateSchema.safeParse(payload);

  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.success ? { formErrors: ["At least one field is required"] } : parsed.error.flatten() }, { status: 400 });
  }

  try {
    const fuelLog = await prisma.fuelLog.update({
      where: { id },
      data: buildFuelData(parsed.data),
    });

    return NextResponse.json(fuelLog);
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Fuel log not found" }, { status: 404 });
    }

    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: "Fuel log already exists" }, { status: 409 });
    }

    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Referenced vehicle, driver, or trip was not found" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update fuel log" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await prisma.fuelLog.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Fuel log not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to delete fuel log" }, { status: 500 });
  }
}