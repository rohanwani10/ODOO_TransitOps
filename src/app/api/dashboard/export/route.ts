import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return new Response("Invalid date range parameters", { status: 400 });
    }

    const { startDate, endDate } = parsed.data;

    let dateFilter = {};
    let dateFilterTrips = {};
    if (startDate || endDate) {
      dateFilter = {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      };
      dateFilterTrips = {
        scheduledStart: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      };
    }

    // Parallel fetch (same as stats endpoint)
    const [
      vehicleStatusCounts,
      tripStatusCounts,
      driverStatusCounts,
      fuelLogs,
      maintenanceLogs,
      expenses,
      tripsWithRevenue,
      vehiclesWithCost
    ] = await Promise.all([
      prisma.vehicle.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.trip.groupBy({ by: ["status"], _count: { id: true }, where: dateFilterTrips }),
      prisma.driver.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.fuelLog.aggregate({ _sum: { quantity: true, totalCost: true }, where: dateFilter }),
      prisma.maintenanceLog.aggregate({ _sum: { cost: true }, where: dateFilter }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: dateFilter }),
      prisma.trip.aggregate({ _sum: { distanceKm: true, revenue: true }, where: dateFilterTrips }),
      prisma.vehicle.aggregate({ _sum: { acquisitionCost: true } }),
    ]);

    const activeVehicles = vehicleStatusCounts.reduce((acc, row) => 
      row.status !== "RETIRED" ? acc + row._count.id : acc, 0);
    const vehiclesOnTrip = vehicleStatusCounts.find(r => r.status === "ON_TRIP")?._count.id || 0;
    
    const fleetUtilizationPct = activeVehicles > 0 ? (vehiclesOnTrip / activeVehicles) * 100 : 0;
    
    const totalDistance = tripsWithRevenue._sum.distanceKm ?? 0;
    const totalFuel = Number(fuelLogs._sum.quantity ?? 0);
    const fuelEfficiency = totalFuel > 0 ? (totalDistance / totalFuel) : 0;

    const fuelCost = Number(fuelLogs._sum.totalCost ?? 0);
    const maintenanceCost = Number(maintenanceLogs._sum.cost ?? 0);
    const otherExpenses = Number(expenses._sum.amount ?? 0);
    const operationalCost = fuelCost + maintenanceCost + otherExpenses;

    const totalRevenue = Number(tripsWithRevenue._sum.revenue ?? 0);
    const acquisitionCost = Number(vehiclesWithCost._sum.acquisitionCost ?? 0);
    const vehicleROI = acquisitionCost > 0 
      ? ((totalRevenue - (maintenanceCost + fuelCost)) / acquisitionCost) * 100
      : 0;

    // Generate CSV String
    const csvRows = [
      ["Metric", "Value", "Description"],
      ["Date Range", `${startDate || "All Time"} to ${endDate || "Present"}`, "Period for this report"],
      ["Active Vehicles", activeVehicles.toString(), "Total vehicles not retired"],
      ["Fleet Utilization (%)", fleetUtilizationPct.toFixed(2), "Percentage of active vehicles currently on a trip"],
      ["Fuel Efficiency (km/L)", fuelEfficiency.toFixed(2), "Total distance divided by total fuel quantity"],
      ["Fuel Cost (₹)", fuelCost.toFixed(2), "Total cost of fuel"],
      ["Maintenance Cost (₹)", maintenanceCost.toFixed(2), "Total cost of maintenance"],
      ["Other Expenses (₹)", otherExpenses.toFixed(2), "Total of other operational expenses"],
      ["Operational Cost (₹)", operationalCost.toFixed(2), "Sum of fuel, maintenance, and other expenses"],
      ["Total Revenue (₹)", totalRevenue.toFixed(2), "Sum of all trip revenue"],
      ["Vehicle ROI (%)", vehicleROI.toFixed(2), "(Revenue - (Maintenance + Fuel)) / Acquisition Cost"],
    ];

    const csvContent = csvRows.map(row => row.join(",")).join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="transitops_report_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error("GET /api/dashboard/export error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
