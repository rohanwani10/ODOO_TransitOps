import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

const expenseUpdateSchema = z.object({
  vehicleId: z.string().trim().min(1).optional(),
  tripId: z.string().trim().min(1).optional().nullable(),
  submittedById: z.string().trim().min(1).optional(),
  category: expenseCategorySchema.optional(),
  amount: z.coerce.number().positive().optional(),
  description: z.string().trim().min(1).optional(),
  receiptUrl: z.string().trim().min(1).optional().nullable(),
  status: expenseStatusSchema.optional(),
  reviewedById: z.string().trim().min(1).optional().nullable(),
  reviewNote: z.string().trim().min(1).optional().nullable(),
  reviewedAt: z.coerce.date().optional().nullable(),
  incurredAt: z.coerce.date().optional(),
}).strict();

function buildExpenseData(input: z.infer<typeof expenseUpdateSchema>) {
  const data: Record<string, unknown> = {};

  if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId;
  if (input.tripId !== undefined) data.tripId = input.tripId;
  if (input.submittedById !== undefined) data.submittedById = input.submittedById;
  if (input.category !== undefined) data.category = input.category;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.description !== undefined) data.description = input.description;
  if (input.receiptUrl !== undefined) data.receiptUrl = input.receiptUrl;
  if (input.status !== undefined) data.status = input.status;
  if (input.reviewedById !== undefined) data.reviewedById = input.reviewedById;
  if (input.reviewNote !== undefined) data.reviewNote = input.reviewNote;
  if (input.reviewedAt !== undefined) data.reviewedAt = input.reviewedAt;
  if (input.incurredAt !== undefined) data.incurredAt = input.incurredAt;

  return data;
}

function isPrismaUniqueError(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}

function isPrismaNotFoundError(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const expense = await prisma.expense.findUnique({ where: { id } });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  return NextResponse.json(expense);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = expenseUpdateSchema.safeParse(payload);

  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.success ? { formErrors: ["At least one field is required"] } : parsed.error.flatten() }, { status: 400 });
  }

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data: buildExpenseData(parsed.data),
    });

    return NextResponse.json(expense);
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: "Expense already exists" }, { status: 409 });
    }

    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Referenced vehicle, trip, or user was not found" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await prisma.expense.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}