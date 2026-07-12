import { prisma } from "@/lib/prisma";
import { errorResponse, Errors, successResponse } from "@/lib/api-response";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Helper: parse optional date range from query params
// ---------------------------------------------------------------------------

function parseDateRange(url: URL): { dateFrom?: Date; dateTo?: Date } {
    const result: { dateFrom?: Date; dateTo?: Date } = {};

    const from = url.searchParams.get("dateFrom")?.trim();
    const to = url.searchParams.get("dateTo")?.trim();

    if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) result.dateFrom = d;
    }

    if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) {
            d.setHours(23, 59, 59, 999); // include full end day
            result.dateTo = d;
        }
    }

    // Validate: end must be >= start
    if (result.dateFrom && result.dateTo && result.dateTo < result.dateFrom) {
        throw new RangeError("dateTo must be on or after dateFrom");
    }

    return result;
}

// ---------------------------------------------------------------------------
// GET /api/vehicles/[id]/cost-summary
// ---------------------------------------------------------------------------

/**
 * Returns an aggregated operational cost breakdown for a single vehicle.
 *
 * Per SRS §11.5 formulas:
 *   Operational Cost = SUM(fuel_logs.totalCost) + SUM(maintenance_logs.cost) + SUM(expenses.amount WHERE status = APPROVED)
 *   Fuel Efficiency  = SUM(trips.distanceKm) / SUM(fuel_logs.quantity)   [COMPLETED trips only]
 *
 * Query params:
 *   dateFrom — ISO date, optional start of reporting period
 *   dateTo   — ISO date, optional end of reporting period
 *
 * Response shape:
 * {
 *   vehicleId, registrationNo, make, model,
 *   period: { from, to },
 *   fuelCost,          // sum of fuel_logs.totalCost
 *   maintenanceCost,   // sum of maintenance_logs.cost (COMPLETED only)
 *   otherExpenses,     // sum of expenses.amount (APPROVED only, non-FUEL/MAINTENANCE categories)
 *   totalOperationalCost,
 *   totalFuelLiters,   // sum of fuel_logs.quantity
 *   totalDistanceKm,   // sum of trips.distanceKm (COMPLETED)
 *   fuelEfficiencyKmPerL,
 *   tripCount,         // COMPLETED trips count
 *   fuelLogCount,
 *   expenseCount,      // APPROVED expenses
 *   maintenanceCount,  // COMPLETED maintenance records
 * }
 *
 * TODO: Integrate RBAC → ADMIN and MANAGER roles only.
 */
export async function GET(request: Request, context: RouteContext) {
    const { id } = await context.params;

    // 1. Parse date range
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    try {
        const url = new URL(request.url);
        const range = parseDateRange(url);
        dateFrom = range.dateFrom;
        dateTo = range.dateTo;
    } catch (err) {
        if (err instanceof RangeError) {
            return errorResponse("VALIDATION_ERROR", err.message, 422, {
                dateTo: "Must be on or after dateFrom",
            });
        }
        return Errors.internal();
    }

    // 2. Verify vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
        where: { id },
        select: {
            id: true,
            registrationNo: true,
            make: true,
            model: true,
            type: true,
            status: true,
            odometerKm: true,
        },
    });

    if (!vehicle) return Errors.notFound("Vehicle");

    // 3. Build date-range filter helpers
    //    filledAt / completedAt / incurredAt all use the same window
    const dateFilter = (field: string) => {
        if (!dateFrom && !dateTo) return undefined;
        const f: Record<string, Date> = {};
        if (dateFrom) f.gte = dateFrom;
        if (dateTo) f.lte = dateTo;
        return { [field]: f };
    };

    const fuelDateFilter = dateFilter("filledAt");
    const maintenanceDateFilter = dateFilter("completedAt");
    const expenseDateFilter = dateFilter("incurredAt");
    const tripDateFilter = dateFilter("actualEnd");

    // 4. Run all aggregations in parallel
    const [fuelAgg, maintenanceAgg, expenseAgg, tripAgg, tripCount, fuelLogCount, expenseCount, maintenanceCount] =
        await Promise.all([
            // ── Fuel cost & volume ─────────────────────────────────────────────
            prisma.fuelLog.aggregate({
                where: {
                    vehicleId: id,
                    ...(fuelDateFilter ?? {}),
                },
                _sum: { totalCost: true, quantity: true },
            }),

            // ── Maintenance cost (COMPLETED records only) ──────────────────────
            prisma.maintenanceLog.aggregate({
                where: {
                    vehicleId: id,
                    status: "COMPLETED",
                    ...(maintenanceDateFilter ?? {}),
                },
                _sum: { cost: true },
            }),

            // ── Other approved expenses (exclude FUEL & MAINTENANCE categories
            //    to avoid double-counting with fuel_logs and maintenance_logs) ──
            prisma.expense.aggregate({
                where: {
                    vehicleId: id,
                    status: "APPROVED",
                    category: { notIn: ["FUEL", "MAINTENANCE"] },
                    ...(expenseDateFilter ?? {}),
                },
                _sum: { amount: true },
            }),

            // ── Completed trip distance (for fuel efficiency) ──────────────────
            prisma.trip.aggregate({
                where: {
                    vehicleId: id,
                    status: "COMPLETED",
                    distanceKm: { not: null },
                    ...(tripDateFilter ?? {}),
                },
                _sum: { distanceKm: true },
            }),

            // ── Counts ───────────────────────────────────────────────────────
            prisma.trip.count({
                where: {
                    vehicleId: id,
                    status: "COMPLETED",
                    ...(tripDateFilter ?? {}),
                },
            }),
            prisma.fuelLog.count({
                where: { vehicleId: id, ...(fuelDateFilter ?? {}) },
            }),
            prisma.expense.count({
                where: {
                    vehicleId: id,
                    status: "APPROVED",
                    ...(expenseDateFilter ?? {}),
                },
            }),
            prisma.maintenanceLog.count({
                where: {
                    vehicleId: id,
                    status: "COMPLETED",
                    ...(maintenanceDateFilter ?? {}),
                },
            }),
        ]);

    // 5. Compute derived metrics per SRS §11.5
    const fuelCost = Number(fuelAgg._sum.totalCost ?? 0);
    const maintenanceCost = Number(maintenanceAgg._sum.cost ?? 0);
    const otherExpenses = Number(expenseAgg._sum.amount ?? 0);
    const totalOperationalCost = fuelCost + maintenanceCost + otherExpenses;

    const totalFuelLiters = Number(fuelAgg._sum.quantity ?? 0);
    const totalDistanceKm = Number(tripAgg._sum.distanceKm ?? 0);

    // Fuel Efficiency = Total Distance / Total Fuel (avoid division by zero)
    const fuelEfficiencyKmPerL =
        totalFuelLiters > 0
            ? parseFloat((totalDistanceKm / totalFuelLiters).toFixed(2))
            : null;

    // 6. Build response
    return successResponse({
        vehicleId: vehicle.id,
        registrationNo: vehicle.registrationNo,
        make: vehicle.make,
        model: vehicle.model,
        type: vehicle.type,
        vehicleStatus: vehicle.status,
        currentOdometerKm: vehicle.odometerKm,

        // Reporting period
        period: {
            from: dateFrom?.toISOString().split("T")[0] ?? null,
            to: dateTo?.toISOString().split("T")[0] ?? null,
        },

        // Cost breakdown (SRS §11.5: Operational Cost = Fuel + Maintenance + Other Expenses)
        fuelCost: parseFloat(fuelCost.toFixed(2)),
        maintenanceCost: parseFloat(maintenanceCost.toFixed(2)),
        otherExpenses: parseFloat(otherExpenses.toFixed(2)),
        totalOperationalCost: parseFloat(totalOperationalCost.toFixed(2)),

        // Efficiency metrics
        totalFuelLiters: parseFloat(totalFuelLiters.toFixed(2)),
        totalDistanceKm,
        // null when no fuel data exists for the period
        fuelEfficiencyKmPerL,

        // Record counts for context
        tripCount,
        fuelLogCount,
        approvedExpenseCount: expenseCount,
        completedMaintenanceCount: maintenanceCount,
    });
}
