import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats — Combined dashboard KPIs per SRS §9.1
//
// Returns:
//   Vehicle KPIs: active, available, in maintenance, on trip
//   Trip KPIs:    active (dispatched), pending (draft), completed, cancelled
//   Driver KPIs:  total, on duty, available
//   Fleet utilization %
// ---------------------------------------------------------------------------

export async function GET() {
    try {
        const [
            vehicleStatusCounts,
            tripStatusCounts,
            driverStatusCounts,
            totalDrivers,
        ] = await Promise.all([
            prisma.vehicle.groupBy({
                by: ["status"],
                _count: { id: true },
            }),
            prisma.trip.groupBy({
                by: ["status"],
                _count: { id: true },
            }),
            prisma.driver.groupBy({
                by: ["status"],
                _count: { id: true },
            }),
            prisma.driver.count(),
        ]);

        // Build vehicle status map
        const vByStatus: Record<string, number> = {};
        for (const row of vehicleStatusCounts) {
            vByStatus[row.status] = row._count.id;
        }

        // Build trip status map
        const tByStatus: Record<string, number> = {};
        for (const row of tripStatusCounts) {
            tByStatus[row.status] = row._count.id;
        }

        // Build driver status map
        const dByStatus: Record<string, number> = {};
        for (const row of driverStatusCounts) {
            dByStatus[row.status] = row._count.id;
        }

        const totalVehicles = Object.values(vByStatus).reduce((a, b) => a + b, 0);
        const retiredVehicles = vByStatus["RETIRED"] ?? 0;
        const activeVehicles = totalVehicles - retiredVehicles;
        const availableVehicles = vByStatus["AVAILABLE"] ?? 0;
        const vehiclesOnTrip = vByStatus["ON_TRIP"] ?? 0;
        const vehiclesInMaintenance = vByStatus["MAINTENANCE"] ?? 0;

        const activeTrips = tByStatus["DISPATCHED"] ?? 0;
        const pendingTrips = tByStatus["DRAFT"] ?? 0;
        const scheduledTrips = tByStatus["SCHEDULED"] ?? 0;
        const completedTrips = tByStatus["COMPLETED"] ?? 0;
        const cancelledTrips = tByStatus["CANCELLED"] ?? 0;

        const driversOnDuty = dByStatus["ON_TRIP"] ?? 0;
        const driversAvailable = dByStatus["AVAILABLE"] ?? 0;

        const fleetUtilizationPct =
            activeVehicles > 0
                ? Math.round((vehiclesOnTrip / activeVehicles) * 10000) / 100
                : 0;

        return NextResponse.json({
            success: true,
            data: {
                // Vehicle KPIs
                activeVehicles,
                availableVehicles,
                vehiclesOnTrip,
                vehiclesInMaintenance,

                // Trip KPIs
                activeTrips,
                pendingTrips,
                scheduledTrips,
                completedTrips,
                cancelledTrips,

                // Driver KPIs
                totalDrivers,
                driversOnDuty,
                driversAvailable,

                // Derived
                fleetUtilizationPct,
            },
        });
    } catch (error) {
        console.error("GET /api/dashboard/stats error:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to fetch dashboard statistics",
                },
            },
            { status: 500 },
        );
    }
}
