import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  vehicleId: z.string().optional(),
  region: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date range parameters" } },
        { status: 400 }
      );
    }

    const { startDate, endDate, vehicleId, region } = parsed.data;
    const vehicleWhere = {
      ...(vehicleId && { id: vehicleId }),
      ...(region && { region }),
    };
    const relatedVehicleWhere = {
      ...(vehicleId && { vehicleId }),
      ...(region && { vehicle: { region } }),
    };

    let dateFilter = {};
    let dateFilterTrips = {};
    if (startDate || endDate) {
      dateFilter = {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      };
      // Trips use scheduledStart as their primary date for reporting
      dateFilterTrips = {
        scheduledStart: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      };
    }

    const fuelExpenseWhere = {
      ...dateFilter,
      ...relatedVehicleWhere,
    };
    const tripWhere = {
      ...dateFilterTrips,
      ...relatedVehicleWhere,
    };

    const [
      vehicleStatusCounts,
      tripStatusCounts,
      driverStatusCounts,
      totalDrivers,
      fuelLogs,
      maintenanceLogs,
      expenses,
      tripsWithRevenue,
      vehiclesWithCost
    ] = await Promise.all([
      prisma.vehicle.groupBy({
        by: ["status"],
        _count: { id: true },
        where: vehicleWhere,
      }),
      prisma.trip.groupBy({
        by: ["status"],
        _count: { id: true },
        where: tripWhere,
      }),
      prisma.driver.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.driver.count(),
      prisma.fuelLog.aggregate({
        _sum: { quantity: true, totalCost: true },
        where: fuelExpenseWhere,
      }),
      prisma.maintenanceLog.aggregate({
        _sum: { cost: true },
        where: fuelExpenseWhere,
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: fuelExpenseWhere,
      }),
      prisma.trip.aggregate({
        _sum: { distanceKm: true, revenue: true },
        where: tripWhere,
      }),
      prisma.vehicle.aggregate({
        _sum: { acquisitionCost: true },
        where: vehicleWhere,
      }),
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

    // Fuel Efficiency = Total Distance / Total Fuel
    const totalDistance = tripsWithRevenue._sum.distanceKm ?? 0;
    const totalFuel = Number(fuelLogs._sum.quantity ?? 0);
    const fuelEfficiency = totalFuel > 0 ? (totalDistance / totalFuel) : 0;

    // Operational Cost = Fuel + Maintenance + Other Expenses
    const fuelCost = Number(fuelLogs._sum.totalCost ?? 0);
    const maintenanceCost = Number(maintenanceLogs._sum.cost ?? 0);
    const otherExpenses = Number(expenses._sum.amount ?? 0);
    const operationalCost = fuelCost + maintenanceCost + otherExpenses;

    // Vehicle ROI = (Revenue - (Maintenance + Fuel)) / Acquisition Cost
    const totalRevenue = Number(tripsWithRevenue._sum.revenue ?? 0);
    const acquisitionCost = Number(vehiclesWithCost._sum.acquisitionCost ?? 0);
    const vehicleROI = acquisitionCost > 0 
      ? ((totalRevenue - (maintenanceCost + fuelCost)) / acquisitionCost) * 100
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

        // Derived & Financial KPIs
        fleetUtilizationPct,
        fuelEfficiency: Math.round(fuelEfficiency * 100) / 100,
        operationalCost: Math.round(operationalCost * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        vehicleROIPct: Math.round(vehicleROI * 100) / 100,
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
