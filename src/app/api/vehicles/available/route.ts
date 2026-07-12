import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/vehicles/available — Vehicles eligible for dispatch
//
// Returns only vehicles where:
//   - status is AVAILABLE
//   - not soft-deleted
//
// Per SRS §7.2 and Business Rules §1.8:
//   "Retired or In Shop vehicles never appear in dispatch selection"
//   "A vehicle already On Trip cannot be assigned to another trip"
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const type = url.searchParams.get("type")?.trim();
        const region = url.searchParams.get("region")?.trim();
        const minCapacity = url.searchParams.get("minCapacity");

        const filters: Record<string, unknown>[] = [
            { status: "AVAILABLE" },
            { deletedAt: null },
        ];

        // Optional: filter by vehicle type
        if (type) {
            filters.push({ type });
        }

        // Optional: filter by region
        if (region) {
            filters.push({
                region: { contains: region, mode: "insensitive" },
            });
        }

        // Optional: filter by minimum load capacity (for cargo weight validation)
        if (minCapacity) {
            const min = parseFloat(minCapacity);
            if (!isNaN(min) && min > 0) {
                filters.push({
                    maxLoadCapacityKg: { gte: min },
                });
            }
        }

        const vehicles = await prisma.vehicle.findMany({
            where: { AND: filters },
            orderBy: [{ make: "asc" }, { model: "asc" }],
            select: {
                id: true,
                registrationNo: true,
                make: true,
                model: true,
                year: true,
                type: true,
                fuelType: true,
                maxLoadCapacityKg: true,
                odometerKm: true,
                seatingCapacity: true,
                region: true,
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
