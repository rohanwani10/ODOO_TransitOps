import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    noContentResponse,
    errorResponse,
    Errors,
    successResponse,
} from "@/lib/api-response";
import {
    isForeignKeyError,
    isNotFoundError,
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

/**
 * Partial update schema for PATCH.
 * - Does NOT expose status — use dedicated /approve or /reject endpoints.
 * - incurredAt cannot be a future date.
 * - amount >= 0.
 *
 * Business rule: Cannot edit financial fields (amount, category) on APPROVED/REJECTED expenses.
 * That check is done in the handler, not the schema.
 */
const expenseUpdateSchema = z
    .object({
        vehicleId: z.string().trim().min(1).optional(),
        tripId: z.string().trim().min(1).optional().nullable(),
        category: expenseCategorySchema.optional(),
        amount: z.coerce.number().nonnegative("Amount cannot be negative").optional(),
        description: z.string().trim().min(1).optional(),
        receiptUrl: z.string().trim().url("receiptUrl must be a valid URL").optional().nullable(),
        incurredAt: z.coerce.date().optional(),
    })
    .strict()
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

function buildUpdateData(input: z.infer<typeof expenseUpdateSchema>): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId;
    if (input.tripId !== undefined) data.tripId = input.tripId;
    if (input.category !== undefined) data.category = input.category;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.description !== undefined) data.description = input.description;
    if (input.receiptUrl !== undefined) data.receiptUrl = input.receiptUrl;
    if (input.incurredAt !== undefined) data.incurredAt = input.incurredAt;
    return data;
}

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/expenses/[id]
// ---------------------------------------------------------------------------

/**
 * Returns a single expense with full relation details.
 *
 * TODO: Integrate auth → DRIVER can only fetch their own expense.
 */
export async function GET(_request: Request, context: RouteContext) {
    const { id } = await context.params;

    try {
        const expense = await prisma.expense.findUnique({
            where: { id },
            include: {
                vehicle: { select: { id: true, registrationNo: true, make: true, model: true } },
                trip: {
                    select: {
                        id: true,
                        origin: true,
                        destination: true,
                        status: true,
                        scheduledStart: true,
                    },
                },
                submittedBy: { select: { id: true, name: true, email: true, role: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
            },
        });

        if (!expense) return Errors.notFound("Expense");
        return successResponse(expense);
    } catch (error) {
        console.error("[expenses/[id]:GET]", error);
        return Errors.internal();
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/expenses/[id]
// ---------------------------------------------------------------------------

/**
 * Partially updates an expense's content fields.
 *
 * Business rules:
 * - Cannot edit financial fields (amount, category) on APPROVED or REJECTED expenses.
 *   Only description and receiptUrl may be updated on a closed expense.
 * - incurredAt cannot be a future date.
 * - Status changes go through dedicated /approve and /reject endpoints.
 *
 * TODO: Integrate RBAC → ADMIN, MANAGER; DRIVER can only edit their own PENDING expenses.
 */
export async function PATCH(request: Request, context: RouteContext) {
    const { id } = await context.params;

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return Errors.invalidJson();
    }

    const parsed = expenseUpdateSchema.safeParse(payload);
    if (!parsed.success) {
        const flat = parsed.error.flatten();
        return errorResponse(
            "VALIDATION_ERROR",
            "Validation failed",
            422,
            flat.fieldErrors as Record<string, string[]>,
        );
    }

    const input = parsed.data;

    // Business rule: incurredAt not in future
    if (input.incurredAt && input.incurredAt > new Date()) {
        return Errors.futureDate("incurredAt");
    }

    // Fetch existing expense to enforce business rules
    const existing = await prisma.expense.findUnique({
        where: { id },
        select: { status: true },
    });

    if (!existing) return Errors.notFound("Expense");

    // Business rule: cannot change financial fields on a closed expense
    if (
        existing.status !== "PENDING" &&
        (input.amount !== undefined || input.category !== undefined || input.incurredAt !== undefined)
    ) {
        return errorResponse(
            "INVALID_STATE",
            `Cannot modify financial fields on a ${existing.status} expense. Only description and receiptUrl may be updated.`,
            409,
        );
    }

    try {
        const updated = await prisma.expense.update({
            where: { id },
            data: buildUpdateData(input),
            include: {
                vehicle: { select: { id: true, registrationNo: true } },
                submittedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
            },
        });
        return successResponse(updated);
    } catch (error) {
        console.error("[expenses/[id]:PATCH]", error);
        if (isNotFoundError(error)) return Errors.notFound("Expense");
        if (isUniqueConstraintError(error)) return Errors.conflict("Expense already exists with these details");
        if (isForeignKeyError(error)) return Errors.conflict("Referenced vehicle or trip was not found");
        return Errors.internal();
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/expenses/[id]
// ---------------------------------------------------------------------------

/**
 * Deletes an expense.
 *
 * Business rule: Cannot delete an APPROVED expense.
 *
 * TODO: Integrate RBAC → ADMIN only.
 */
export async function DELETE(_request: Request, context: RouteContext) {
    const { id } = await context.params;

    // Check existence and status before deleting
    const existing = await prisma.expense.findUnique({
        where: { id },
        select: { status: true },
    });

    if (!existing) return Errors.notFound("Expense");

    // Business rule: APPROVED expenses cannot be deleted (financial integrity)
    if (existing.status === "APPROVED") {
        return errorResponse(
            "INVALID_STATE",
            "Cannot delete an approved expense. Reject it first if removal is required.",
            409,
        );
    }

    try {
        await prisma.expense.delete({ where: { id } });
        return noContentResponse();
    } catch (error) {
        console.error("[expenses/[id]:DELETE]", error);
        if (isNotFoundError(error)) return Errors.notFound("Expense");
        return Errors.internal();
    }
}