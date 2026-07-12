import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, Errors, successResponse } from "@/lib/api-response";
import { isNotFoundError } from "@/lib/prisma-errors";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const approveSchema = z
    .object({
        reviewNote: z.string().trim().min(1).optional().nullable(),
    })
    .strict();

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/expenses/[id]/approve
// ---------------------------------------------------------------------------

/**
 * Approves a PENDING expense.
 *
 * Business rules:
 * - Expense must currently be in PENDING status.
 * - Sets status → APPROVED, recordsreviewedById, reviewedAt = now().
 * - reviewNote is optional for approval.
 *
 * TODO: Integrate auth → get reviewerId from JWT (req.user.id).
 * TODO: Integrate RBAC → ADMIN and MANAGER roles only.
 *
 * Body: { reviewNote?: string }
 */
export async function PATCH(request: Request, context: RouteContext) {
    const { id } = await context.params;

    // Parse optional body
    let reviewNote: string | null = null;
    try {
        const body = await request.json().catch(() => ({}));
        const parsed = approveSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse(
                "VALIDATION_ERROR",
                "Validation failed",
                422,
                parsed.error.flatten().fieldErrors as Record<string, string[]>,
            );
        }
        reviewNote = parsed.data.reviewNote ?? null;
    } catch {
        // Body is optional — proceed without it
    }

    // 1. Fetch expense to check current state
    const existing = await prisma.expense.findUnique({
        where: { id },
        select: { id: true, status: true },
    });

    if (!existing) return Errors.notFound("Expense");

    // 2. Business rule: can only approve a PENDING expense
    if (existing.status !== "PENDING") {
        return errorResponse(
            "INVALID_STATE",
            `Cannot approve an expense that is already ${existing.status}. Only PENDING expenses can be approved.`,
            409,
            { status: `Current status is ${existing.status}` },
        );
    }

    // 3. Perform approval
    // TODO: Replace hardcoded reviewedById with req.user.id from auth middleware
    try {
        const updated = await prisma.expense.update({
            where: { id },
            data: {
                status: "APPROVED",
                reviewedAt: new Date(),
                reviewNote: reviewNote,
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
        console.error("[expenses/[id]/approve:PATCH]", error);
        if (isNotFoundError(error)) return Errors.notFound("Expense");
        return Errors.internal();
    }
}
