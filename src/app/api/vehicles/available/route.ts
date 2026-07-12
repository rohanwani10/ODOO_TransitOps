import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/vehicles/available — Vehicles eligible for dispatch
//
// Returns only vehicles where status is AVAILABLE.
// Optionally filter by vehicle type and minimum payload capacity.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const type = url.searchParams.get("type")?.trim();
        const minCapacity = url.searchParams.get("minCapacity");

        const where: Record<string, unknown> = { status: "AVAILABLE" };

        // Optional: filter by vehicle type
        if (type) {
            where.type = type;
        }

        // Optional: filter by minimum payload capacity (for cargo weight validation)
        if (minCapacity) {
            const min = parseInt(minCapacity, 10);
            if (!isNaN(min) && min > 0) {
                where.payloadCapacityKg = { gte: min };
            }
        }

        const vehicles = await prisma.vehicle.findMany({
            where,
            orderBy: [{ make: "asc" }, { model: "asc" }],
            select: {
                id: true,
                registrationNo: true,
                make: true,
                model: true,
                year: true,
                type: true,
                fuelType: true,
                payloadCapacityKg: true,
                odometerKm: true,
                seatingCapacity: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: vehicles,
            meta: { total: vehicles.length },
        });
    } catch {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to fetch available vehicles",
                },
            },
            { status: 500 }
        );
    }
}
