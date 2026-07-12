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

const expenseUpdateSchema = expenseCreateSchema.partial().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: "custom", message: "At least one field is required" });
  }
});

function parsePagination(url: URL) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function buildExpenseWhere(url: URL) {
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");

  const filters: Record<string, unknown>[] = [];

  if (q) {
    filters.push({
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { reviewNote: { contains: q, mode: "insensitive" } },
        { vehicle: { registrationNo: { contains: q, mode: "insensitive" } } },
        { submittedBy: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (status && expenseStatusSchema.safeParse(status).success) {
    filters.push({ status });
  }

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
}

function buildExpenseData(input: z.infer<typeof expenseCreateSchema>) {
  return {
    vehicleId: input.vehicleId,
    tripId: input.tripId ?? null,
    submittedById: input.submittedById,
    category: input.category,
    amount: input.amount,
    description: input.description,
    receiptUrl: input.receiptUrl ?? null,
    status: input.status ?? "PENDING",
    reviewedById: input.reviewedById ?? null,
    reviewNote: input.reviewNote ?? null,
    reviewedAt: input.reviewedAt ?? null,
    incurredAt: input.incurredAt,
  };
}

function isPrismaUniqueError(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}

function isPrismaNotFoundError(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { page, limit, skip } = parsePagination(url);
  const where = buildExpenseWhere(url);

  const [items, total] = await prisma.$transaction([
    prisma.expense.findMany({
      where,
      orderBy: { incurredAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = expenseCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const expense = await prisma.expense.create({ data: buildExpenseData(parsed.data) });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: "Expense already exists" }, { status: 409 });
    }

    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Referenced vehicle, trip, or user was not found" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}