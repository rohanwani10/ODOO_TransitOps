import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const driverStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

const driverUpdateSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  licenseNumber: z.string().trim().min(1).optional(),
  licenseNo: z.string().trim().min(1).optional(),
  licenseExpiry: z.coerce.date().optional(),
  phone: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  status: driverStatusSchema.optional(),
  emergencyName: z.string().trim().min(1).optional().nullable(),
  emergencyPhone: z.string().trim().min(1).optional().nullable(),
  imageUrl: z.string().trim().min(1).optional().nullable(),
  hiredAt: z.coerce.date().optional(),
}).strict();

function parsePaginationCheck(value: z.infer<typeof driverUpdateSchema>) {
  return Object.keys(value).length > 0;
}

function buildDriverData(input: z.infer<typeof driverUpdateSchema>) {
  const data: Record<string, unknown> = {};
  const licenseNo = input.licenseNumber ?? input.licenseNo;

  if (input.userId !== undefined) data.userId = input.userId;
  if (licenseNo !== undefined) data.licenseNo = licenseNo;
  if (input.licenseExpiry !== undefined) data.licenseExpiry = input.licenseExpiry;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.address !== undefined) data.address = input.address;
  if (input.dateOfBirth !== undefined) data.dateOfBirth = input.dateOfBirth;
  if (input.status !== undefined) data.status = input.status;
  if (input.emergencyName !== undefined) data.emergencyName = input.emergencyName;
  if (input.emergencyPhone !== undefined) data.emergencyPhone = input.emergencyPhone;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.hiredAt !== undefined) data.hiredAt = input.hiredAt;

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

  const driver = await prisma.driver.findUnique({ where: { id } });

  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  return NextResponse.json(driver);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = driverUpdateSchema.safeParse(payload);

  if (!parsed.success || !parsePaginationCheck(parsed.data)) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.success ? { formErrors: ["At least one field is required"] } : parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.userId) {
    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  }

  try {
    const driver = await prisma.driver.update({
      where: { id },
      data: buildDriverData(parsed.data),
    });

    return NextResponse.json(driver);
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: "Driver license number or user already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update driver" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await prisma.driver.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Driver has related records and cannot be deleted" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to delete driver" }, { status: 500 });
  }
}