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

const vehicleUpdateSchema = z.object({
    registrationNumber: z.string().trim().min(1).optional(),
    make: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    year: z.coerce.number().int().min(1900).max(2100).optional(),
    type: vehicleTypeSchema.optional(),
    fuelType: fuelTypeSchema.optional(),
    status: vehicleStatusSchema.optional(),
    odometerKm: z.coerce.number().int().min(0).optional(),
    seatingCapacity: z.coerce.number().int().positive().optional().nullable(),
    purchaseDate: z.coerce.date().optional(),
    insurancePolicyNo: z.string().trim().min(1).optional().nullable(),
    insuranceExpiry: z.coerce.date().optional().nullable(),
    registrationExpiry: z.coerce.date().optional().nullable(),
    imageUrl: z.string().trim().min(1).optional().nullable(),
}).strict();

function buildVehicleWhere(id: string) {
    return { id };
}

function buildVehicleData(input: z.infer<typeof vehicleUpdateSchema>) {
    const data: Record<string, unknown> = {};

    if (input.registrationNumber !== undefined) data.registrationNo = input.registrationNumber;
    if (input.make !== undefined) data.make = input.make;
    if (input.model !== undefined) data.model = input.model;
    if (input.year !== undefined) data.year = input.year;
    if (input.type !== undefined) data.type = input.type;
    if (input.fuelType !== undefined) data.fuelType = input.fuelType;
    if (input.status !== undefined) data.status = input.status;
    if (input.odometerKm !== undefined) data.odometerKm = input.odometerKm;
    if (input.seatingCapacity !== undefined) data.seatingCapacity = input.seatingCapacity;
    if (input.insurancePolicyNo !== undefined) data.insurancePolicyNo = input.insurancePolicyNo;
    if (input.insuranceExpiry !== undefined) data.insuranceExpiry = input.insuranceExpiry;
    if (input.registrationExpiry !== undefined) data.registrationExpiry = input.registrationExpiry;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;

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

    const vehicle = await prisma.vehicle.findUnique({ where: buildVehicleWhere(id) });

    if (!vehicle) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    return NextResponse.json(vehicle);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = vehicleUpdateSchema.safeParse(payload);

    if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return NextResponse.json({ error: "Validation failed", issues: parsed.success ? { formErrors: ["At least one field is required"] } : parsed.error.flatten() }, { status: 400 });
    }

    try {
        const vehicle = await prisma.vehicle.update({
            where: buildVehicleWhere(id),
            data: buildVehicleData(parsed.data),
        });

        return NextResponse.json(vehicle);
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
        }

        if (isPrismaUniqueError(error)) {
            return NextResponse.json({ error: "Vehicle registration number already exists" }, { status: 409 });
        }

        return NextResponse.json({ error: "Failed to update vehicle" }, { status: 500 });
    }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    try {
        await prisma.vehicle.delete({ where: buildVehicleWhere(id) });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
        }

        if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
            return NextResponse.json({ error: "Vehicle has related records and cannot be deleted" }, { status: 409 });
        }

        return NextResponse.json({ error: "Failed to delete vehicle" }, { status: 500 });
    }
}