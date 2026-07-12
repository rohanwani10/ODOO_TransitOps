import { z } from 'zod';

// ─── Enum mirrors (keeps Zod independent of Prisma client) ────
const vehicleStatusEnum = z.enum(['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED']);
const vehicleTypeEnum   = z.enum(['BUS', 'MINIBUS', 'VAN', 'TRUCK', 'CAR', 'MOTORCYCLE']);
const fuelTypeEnum      = z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID']);

// ─── Reusable field rules ─────────────────────────────────────
const registrationNumber = z
  .string()
  .trim()
  .min(2,  'Registration number too short')
  .max(20, 'Registration number too long')
  .regex(
    /^[A-Z0-9-]+$/i,
    'Registration number may only contain letters, digits, and hyphens',
  )
  .transform((v) => v.toUpperCase());

const currentYear = new Date().getFullYear();

// ─── POST /vehicles ───────────────────────────────────────────
export const createVehicleSchema = z.object({
  registrationNumber,
  make:          z.string().trim().min(1).max(100),
  model:         z.string().trim().min(1).max(100),
  year:          z.number().int().min(1980).max(currentYear + 1),
  type:          vehicleTypeEnum,
  fuelType:      fuelTypeEnum,
  capacity:      z.number().int().min(1).max(500),
  color:         z.string().trim().max(50).optional(),
  chassisNumber: z
    .string()
    .trim()
    .min(5)
    .max(50)
    .transform((v) => v.toUpperCase()),
  engineNumber:  z
    .string()
    .trim()
    .min(3)
    .max(50)
    .transform((v) => v.toUpperCase()),
  insuranceExpiry: z.coerce.date().optional(),
  permitExpiry:    z.coerce.date().optional(),
  fitnessExpiry:   z.coerce.date().optional(),
  imageUrl:        z.string().url('Must be a valid URL').optional(),
});

// ─── PATCH /vehicles/:id ──────────────────────────────────────
// All fields optional — true partial update
export const updateVehicleSchema = z
  .object({
    make:     z.string().trim().min(1).max(100),
    model:    z.string().trim().min(1).max(100),
    year:     z.number().int().min(1980).max(currentYear + 1),
    type:     vehicleTypeEnum,
    fuelType: fuelTypeEnum,
    capacity: z.number().int().min(1).max(500),
    color:    z.string().trim().max(50).nullable(),
    insuranceExpiry: z.coerce.date().nullable(),
    permitExpiry:    z.coerce.date().nullable(),
    fitnessExpiry:   z.coerce.date().nullable(),
    imageUrl:        z.string().url('Must be a valid URL').nullable(),
  })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' },
  );

// ─── PATCH /vehicles/:id/status ───────────────────────────────
export const updateStatusSchema = z.object({
  status: vehicleStatusEnum,
  maintenanceId: z.string().uuid('Invalid maintenance ID').optional(),
});

// ─── PATCH /vehicles/:id/odometer ────────────────────────────
export const updateOdometerSchema = z.object({
  odometer: z
    .number()
    .int('Odometer must be a whole number')
    .nonnegative('Odometer cannot be negative'),
});

// ─── GET /vehicles (query params) ────────────────────────────
export const listVehiclesQuerySchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(100).default(20),
  status:   vehicleStatusEnum.optional(),
  type:     vehicleTypeEnum.optional(),
  fuelType: fuelTypeEnum.optional(),
  search:   z.string().trim().max(100).optional(),
});

// ─── Inferred types (consumed by controllers) ─────────────────
export type CreateVehicleInput  = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput  = z.infer<typeof updateVehicleSchema>;
export type UpdateStatusInput   = z.infer<typeof updateStatusSchema>;
export type UpdateOdometerInput = z.infer<typeof updateOdometerSchema>;
export type ListVehiclesInput   = z.infer<typeof listVehiclesQuerySchema>;
