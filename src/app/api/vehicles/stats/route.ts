import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/vehicles/stats — Vehicle fleet statistics
//
// Returns aggregated KPIs for the dashboard per SRS §9.1:
//   - Active Vehicles:     COUNT(status != RETIRED, not soft-deleted)
//   - Available Vehicles:  COUNT(status = AVAILABLE)
//   - Vehicles In Use:     COUNT(status = IN_USE)
//   - Vehicles In Maintenance: COUNT(status = MAINTENANCE)
//   - Out of Service:      COUNT(status = OUT_OF_SERVICE)
//   - Retired Vehicles:    COUNT(status = RETIRED, not soft-deleted)
//   - By Type breakdown
// ---------------------------------------------------------------------------

export async function GET() {
    try {
        // Count by status (excluding soft-deleted)
        const statusCounts = await prisma.vehicle.groupBy({
            by: ["status"],
            _count: { id: true },
        });

        // Count by type (excluding soft-deleted and retired)
        const typeCounts = await prisma.vehicle.groupBy({
            by: ["type"],
            where: { status: { not: "RETIRED" } },
            _count: { id: true },
        });

        // Total non-deleted vehicles
        const total = await prisma.vehicle.count();

        // Build status map
        const byStatus: Record<string, number> = {};
        for (const row of statusCounts) {
            byStatus[row.status] = row._count.id;
        }

        // Build type map
        const byType: Record<string, number> = {};
        for (const row of typeCounts) {
            byType[row.type] = row._count.id;
        }

        const activeVehicles = total - (byStatus["RETIRED"] ?? 0);
        const availableVehicles = byStatus["AVAILABLE"] ?? 0;
        const onTrip = byStatus["ON_TRIP"] ?? 0;
        const inUse = byStatus["IN_USE"] ?? 0;
        const inMaintenance = byStatus["MAINTENANCE"] ?? 0;
        const outOfService = byStatus["OUT_OF_SERVICE"] ?? 0;
        const retired = byStatus["RETIRED"] ?? 0;

        // Fleet utilization % (vehicles on trip or in use / active vehicles)
        const fleetUtilizationPct =
            activeVehicles > 0
                ? Math.round(((onTrip + inUse) / activeVehicles) * 10000) / 100
                : 0;

        return NextResponse.json({
            success: true,
            data: {
                total,
                activeVehicles,
                availableVehicles,
                onTrip,
                inUse,
                inMaintenance,
                outOfService,
                retired,
                fleetUtilizationPct,
                byStatus,
                byType,
            },
        });
    } catch {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to fetch vehicle statistics",
                },
            },
            { status: 500 }
        );
    }
}
