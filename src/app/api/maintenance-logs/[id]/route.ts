import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const maintenanceTypeSchema = z.enum(["SCHEDULED", "UNSCHEDULED", "EMERGENCY"]);
const maintenanceStatusSchema = z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

const maintenanceUpdateSchema = z.object({
    vehicleId: z.string().trim().min(1).optional(),
    type: maintenanceTypeSchema.optional(),
    status: maintenanceStatusSchema.optional(),
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional().nullable(),
    vendor: z.string().trim().min(1).optional().nullable(),
    odometerKm: z.coerce.number().int().min(0).optional().nullable(),
    scheduledAt: z.coerce.date().optional(),
    completedAt: z.coerce.date().optional().nullable(),
    cost: z.coerce.number().positive().optional().nullable(),
}).strict();

function buildMaintenanceData(input: z.infer<typeof maintenanceUpdateSchema>) {
    const data: Record<string, unknown> = {};

    if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId;
    if (input.type !== undefined) data.type = input.type;
    if (input.status !== undefined) data.status = input.status;
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.vendor !== undefined) data.vendor = input.vendor;
    if (input.odometerKm !== undefined) data.odometerKm = input.odometerKm;
    if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
    if (input.completedAt !== undefined) data.completedAt = input.completedAt;
    if (input.cost !== undefined) data.cost = input.cost;

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

    const maintenanceLog = await prisma.maintenanceLog.findUnique({ where: { id } });

    if (!maintenanceLog) {
        return NextResponse.json({ error: "Maintenance log not found" }, { status: 404 });
    }

    return NextResponse.json(maintenanceLog);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = maintenanceUpdateSchema.safeParse(payload);

    if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return NextResponse.json({ error: "Validation failed", issues: parsed.success ? { formErrors: ["At least one field is required"] } : parsed.error.flatten() }, { status: 400 });
    }

    try {
        const maintenanceLog = await prisma.maintenanceLog.update({
            where: { id },
            data: buildMaintenanceData(parsed.data),
        });

        return NextResponse.json(maintenanceLog);
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return NextResponse.json({ error: "Maintenance log not found" }, { status: 404 });
        }

        if (isPrismaUniqueError(error)) {
            return NextResponse.json({ error: "Maintenance log already exists" }, { status: 409 });
        }

        if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
            return NextResponse.json({ error: "Referenced vehicle was not found" }, { status: 409 });
        }

        return NextResponse.json({ error: "Failed to update maintenance log" }, { status: 500 });
    }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    try {
        await prisma.maintenanceLog.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return NextResponse.json({ error: "Maintenance log not found" }, { status: 404 });
        }

        return NextResponse.json({ error: "Failed to delete maintenance log" }, { status: 500 });
    }
}