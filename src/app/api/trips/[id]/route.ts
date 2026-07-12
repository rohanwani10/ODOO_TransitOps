import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const tripStatusSchema = z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

const tripUpdateSchema = z
    .object({
        vehicleId: z.string().trim().min(1).optional(),
        driverId: z.string().trim().min(1).optional(),
        origin: z.string().trim().min(1).optional(),
        destination: z.string().trim().min(1).optional(),
        scheduledStart: z.coerce.date().optional(),
        scheduledEnd: z.coerce.date().optional(),
        actualStart: z.coerce.date().optional().nullable(),
        actualEnd: z.coerce.date().optional().nullable(),
        startOdometer: z.coerce.number().int().min(0).optional().nullable(),
        endOdometer: z.coerce.number().int().min(0).optional().nullable(),
        distanceKm: z.coerce.number().int().min(0).optional().nullable(),
        purpose: z.string().trim().min(1).optional().nullable(),
        status: tripStatusSchema.optional(),
        notes: z.string().trim().min(1).optional().nullable(),
    })
    .strict()
    .superRefine((value, context) => {
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

function buildTripData(input: z.infer<typeof tripUpdateSchema>) {
    const data: Record<string, unknown> = {};

    if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId;
    if (input.driverId !== undefined) data.driverId = input.driverId;
    if (input.origin !== undefined) data.origin = input.origin;
    if (input.destination !== undefined) data.destination = input.destination;
    if (input.scheduledStart !== undefined) data.scheduledStart = input.scheduledStart;
    if (input.scheduledEnd !== undefined) data.scheduledEnd = input.scheduledEnd;
    if (input.actualStart !== undefined) data.actualStart = input.actualStart;
    if (input.actualEnd !== undefined) data.actualEnd = input.actualEnd;
    if (input.startOdometer !== undefined) data.startOdometer = input.startOdometer;
    if (input.endOdometer !== undefined) data.endOdometer = input.endOdometer;
    if (input.distanceKm !== undefined) data.distanceKm = input.distanceKm;
    if (input.purpose !== undefined) data.purpose = input.purpose;
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes;

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

    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json(trip);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = tripUpdateSchema.safeParse(payload);

    if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return NextResponse.json({ error: "Validation failed", issues: parsed.success ? { formErrors: ["At least one field is required"] } : parsed.error.flatten() }, { status: 400 });
    }

    try {
        const trip = await prisma.trip.update({
            where: { id },
            data: buildTripData(parsed.data),
        });

        return NextResponse.json(trip);
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return NextResponse.json({ error: "Trip not found" }, { status: 404 });
        }

        if (isPrismaUniqueError(error)) {
            return NextResponse.json({ error: "Trip already exists" }, { status: 409 });
        }

        if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
            return NextResponse.json({ error: "Referenced vehicle or driver was not found" }, { status: 409 });
        }

        return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
    }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    try {
        await prisma.trip.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return NextResponse.json({ error: "Trip not found" }, { status: 404 });
        }

        if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
            return NextResponse.json({ error: "Trip has related records and cannot be deleted" }, { status: 409 });
        }

        return NextResponse.json({ error: "Failed to delete trip" }, { status: 500 });
    }
}