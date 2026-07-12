import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, Errors, successResponse } from "@/lib/api-response";
import { isNotFoundError } from "@/lib/prisma-errors";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Rejection REQUIRES a reviewNote explaining why — this is enforced as a
 * business rule to maintain audit trail quality.
 */
const rejectSchema = z
    .object({
        reviewNote: z
            .string()
            .trim()
            .min(1, "A review note explaining the rejection reason is required"),
    })
    .strict();

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/expenses/[id]/reject
// ---------------------------------------------------------------------------

/**
 * Rejects a PENDING expense.
 *
 * Business rules:
 * - Expense must currently be in PENDING status.
 * - reviewNote is REQUIRED for rejection (auditing requirement).
 * - Sets status → REJECTED, records reviewedById, reviewedAt = now().
 *
 * TODO: Integrate auth → get reviewerId from JWT (req.user.id).
 * TODO: Integrate RBAC → ADMIN and MANAGER roles only.
 *
 * Body: { reviewNote: string }  ← required
 */
export async function PATCH(request: Request, context: RouteContext) {
    const { id } = await context.params;

    // 1. Parse and validate body (reviewNote required)
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return Errors.invalidJson();
    }

    const parsed = rejectSchema.safeParse(payload);
    if (!parsed.success) {
        return errorResponse(
            "VALIDATION_ERROR",
            "Validation failed",
            422,
            parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
    }

    const { reviewNote } = parsed.data;

    // 2. Fetch expense to check current state
    const existing = await prisma.expense.findUnique({
        where: { id },
        select: { id: true, status: true },
    });

    if (!existing) return Errors.notFound("Expense");

    // 3. Business rule: can only reject a PENDING expense
    if (existing.status !== "PENDING") {
        return errorResponse(
            "INVALID_STATE",
            `Cannot reject an expense that is already ${existing.status}. Only PENDING expenses can be rejected.`,
            409,
            { status: `Current status is ${existing.status}` },
        );
    }

    // 4. Perform rejection
    // TODO: Replace with req.user.id from auth middleware: reviewedById: req.user.id
    try {
        const updated = await prisma.expense.update({
            where: { id },
            data: {
                status: "REJECTED",
                reviewedAt: new Date(),
                reviewNote,
                // reviewedById: req.user.id  ← wire in when auth is integrated
            },
            include: {
                vehicle: { select: { id: true, registrationNo: true } },
                submittedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
            },
        });

        return successResponse(updated);
    } catch (error) {
        console.error("[expenses/[id]/reject:PATCH]", error);
        if (isNotFoundError(error)) return Errors.notFound("Expense");
        return Errors.internal();
    }
}
