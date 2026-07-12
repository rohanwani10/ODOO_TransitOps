import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    createdResponse,
    errorResponse,
    Errors,
    successResponse,
    type ApiMeta,
} from "@/lib/api-response";
import {
    isForeignKeyError,
    isUniqueConstraintError,
} from "@/lib/prisma-errors";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const expenseCategorySchema = z.enum([
    "FUEL",
    "MAINTENANCE",
    "TOLL",
    "INSURANCE",
    "REGISTRATION",
    "CLEANING",
    "MISCELLANEOUS",
]);

const expenseStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

const expenseCreateSchema = z.object({
    vehicleId: z.string().trim().min(1),
    tripId: z.string().trim().min(1).optional().nullable(),
    submittedById: z.string().trim().min(1),
    category: expenseCategorySchema,
    amount: z.coerce.number().positive(),
    description: z.string().trim().min(1),
    receiptUrl: z.string().trim().min(1).optional().nullable(),
    status: expenseStatusSchema.optional(),
    reviewedById: z.string().trim().min(1).optional().nullable(),
    reviewNote: z.string().trim().min(1).optional().nullable(),
    reviewedAt: z.coerce.date().optional().nullable(),
    incurredAt: z.coerce.date(),
}).strict();



/**
 * Partial update schema — at least one field required.
 * Does NOT allow changing status directly (use /approve or /reject endpoints).
 */
const expenseUpdateSchema = expenseCreateSchema
    .omit({ status: true }) // status is changed via dedicated approve/reject endpoints
    .partial()
    .superRefine((val, ctx) => {
        if (Object.keys(val).length === 0) {
            ctx.addIssue({ code: "custom", message: "At least one field is required" });
        }
        if (val.incurredAt && val.incurredAt > new Date()) {
            ctx.addIssue({
                code: "custom",
                path: ["incurredAt"],
                message: "incurredAt cannot be a future date",
            });
        }
    });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePagination(url: URL) {
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
    return { page, limit, skip: (page - 1) * limit };
}

function buildExpenseWhere(url: URL) {
    const q = url.searchParams.get("q")?.trim();
    const vehicleId = url.searchParams.get("vehicleId")?.trim();
    const tripId = url.searchParams.get("tripId")?.trim();
    const submittedById = url.searchParams.get("submittedById")?.trim();
    const category = url.searchParams.get("category")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const dateFrom = url.searchParams.get("dateFrom")?.trim();
    const dateTo = url.searchParams.get("dateTo")?.trim();

    const filters: Record<string, unknown>[] = [];

    if (q) {
        filters.push({
            OR: [
                { description: { contains: q, mode: "insensitive" as const } },
                { reviewNote: { contains: q, mode: "insensitive" as const } },
                { vehicle: { registrationNo: { contains: q, mode: "insensitive" as const } } },
                { submittedBy: { name: { contains: q, mode: "insensitive" as const } } },
            ],
        });
    }

    if (vehicleId) filters.push({ vehicleId });
    if (tripId) filters.push({ tripId });
    if (submittedById) filters.push({ submittedById });

    if (category && expenseCategorySchema.safeParse(category).success) {
        filters.push({ category });
    }

    if (status && expenseStatusSchema.safeParse(status).success) {
        filters.push({ status });
    }

    // Date range on incurredAt
    if (dateFrom || dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (dateFrom) {
            const from = new Date(dateFrom);
            if (!isNaN(from.getTime())) dateFilter.gte = from;
        }
        if (dateTo) {
            const to = new Date(dateTo);
            if (!isNaN(to.getTime())) {
                to.setHours(23, 59, 59, 999);
                dateFilter.lte = to;
            }
        }
        if (Object.keys(dateFilter).length > 0) {
            filters.push({ incurredAt: dateFilter });
        }
    }

    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0];
    return { AND: filters };
}

function buildExpenseCreateData(input: z.infer<typeof expenseCreateSchema>) {
    return {
        vehicleId: input.vehicleId,
        tripId: input.tripId ?? null,
        submittedById: input.submittedById,
        category: input.category,
        amount: input.amount,
        description: input.description,
        receiptUrl: input.receiptUrl ?? null,
        // Business rule: status is always PENDING on creation regardless of submitted value
        status: "PENDING" as const,
        incurredAt: input.incurredAt,
    };
}

/**
 * Verify referenced vehicle (and optional trip/user) exist before creating.
 */
async function validateExpenseForeignKeys(
    vehicleId: string,
    submittedById: string,
    tripId?: string | null,
): Promise<NextResponse | null> {
    const [vehicle, user] = await Promise.all([
        prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: submittedById }, select: { id: true } }),
    ]);

    if (!vehicle) {
        return errorResponse("FK_VIOLATION", "Vehicle not found", 409, {
            vehicleId: "Referenced vehicle does not exist",
        });
    }
    if (!user) {
        return errorResponse("FK_VIOLATION", "Submitting user not found", 409, {
            submittedById: "Referenced user does not exist",
        });
    }
    if (tripId) {
        const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
        if (!trip) {
            return errorResponse("FK_VIOLATION", "Trip not found", 409, {
                tripId: "Referenced trip does not exist",
            });
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/expenses
 *
 * Query params:
 *   q            — full-text search (description, review note, vehicle reg, submitter name)
 *   vehicleId    — filter by vehicle
 *   tripId       — filter by trip
 *   submittedById — filter by submitting user
 *   category     — enum filter: FUEL | MAINTENANCE | TOLL | INSURANCE | REGISTRATION | CLEANING | MISCELLANEOUS
 *   status       — enum filter: PENDING | APPROVED | REJECTED
 *   dateFrom     — ISO date, start of range on incurredAt
 *   dateTo       — ISO date, end of range on incurredAt
 *   page         — default 1
 *   limit        — default 10, max 100
 *
 * TODO: Integrate auth → restrict DRIVER role to own submittedById only.
 * TODO: Integrate RBAC → ADMIN, MANAGER, DRIVER roles.
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const { page, limit, skip } = parsePagination(url);
        const where = buildExpenseWhere(url);

        const [items, total] = await prisma.$transaction([
            prisma.expense.findMany({
                where,
                orderBy: { incurredAt: "desc" },
                skip,
                take: limit,
                include: {
                    vehicle: { select: { id: true, registrationNo: true, make: true, model: true } },
                    trip: { select: { id: true, origin: true, destination: true, status: true } },
                    submittedBy: { select: { id: true, name: true, email: true, role: true } },
                    reviewedBy: { select: { id: true, name: true, email: true } },
                },
            }),
            prisma.expense.count({ where }),
        ]);

        const meta: ApiMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        };

        return successResponse(items, meta);
    } catch (error) {
        console.error("[expenses:GET]", error);
        return Errors.internal();
    }
}

/**
 * POST /api/expenses
 *
 * Creates a new expense entry. Status is always set to PENDING on creation.
 *
 * Validation rules (SRS §10):
 * - amount >= 0 (0 is valid)
 * - incurredAt cannot be a future date
 * - vehicleId, submittedById must reference existing records
 * - tripId (if provided) must reference an existing trip
 *
 * TODO: Integrate auth → auto-set submittedById from JWT user.
 * TODO: Integrate RBAC → ADMIN, MANAGER, DRIVER roles.
 */
export async function POST(request: Request) {
    // 1. Parse body
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return Errors.invalidJson();
    }

    // 2. Zod validation
    const parsed = expenseCreateSchema.safeParse(payload);
    if (!parsed.success) {
        const flat = parsed.error.flatten();
        return errorResponse(
            "VALIDATION_ERROR",
            "Validation failed",
            422,
            flat.fieldErrors as Record<string, string[]>,
        );
    }

    const data = parsed.data;

    // 3. Business rule: incurredAt cannot be in future (belt-and-suspenders)
    if (data.incurredAt > new Date()) {
        return Errors.futureDate("incurredAt");
    }

    // 4. Verify FK targets exist
    const fkError = await validateExpenseForeignKeys(
        data.vehicleId,
        data.submittedById,
        data.tripId,
    );
    if (fkError) return fkError;

    // 5. Persist
    try {
        const expense = await prisma.expense.create({
            data: buildExpenseCreateData(data),
            include: {
                vehicle: { select: { id: true, registrationNo: true } },
                submittedBy: { select: { id: true, name: true, email: true } },
            },
        });
        return createdResponse(expense);
    } catch (error) {
        console.error("[expenses:POST]", error);
        if (isUniqueConstraintError(error)) {
            return Errors.conflict("An expense with these details already exists");
        }
        if (isForeignKeyError(error)) {
            return Errors.conflict("Referenced vehicle, trip, or user was not found");
        }
        return Errors.internal();
    }
}