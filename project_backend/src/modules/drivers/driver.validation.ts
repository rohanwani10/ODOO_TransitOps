import { z } from 'zod';

// ─── Enum mirrors ─────────────────────────────────────────────
const driverStatusEnum = z.enum(['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED']);
const licenseClassEnum = z.enum(['A', 'B', 'C', 'D', 'E']);
const safetyEventEnum  = z.enum([
  'TRIP_COMPLETED_ON_TIME',
  'TRIP_COMPLETED_LATE',
  'TRIP_CANCELLED',
  'INCIDENT_REPORTED',
  'LICENSE_EXPIRED',
  'SUSPENSION',
]);

// ─── POST /drivers ────────────────────────────────────────────
export const createDriverSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),

  licenseNumber: z
    .string()
    .trim()
    .min(4,  'License number too short')
    .max(50, 'License number too long')
    .transform((v) => v.toUpperCase()),

  licenseClass: licenseClassEnum,

  licenseExpiry: z.coerce
    .date()
    .refine(
      (d) => d > new Date(),
      { message: 'License expiry must be a future date' },
    ),

  experience: z.number().int().min(0).max(60).optional().default(0),
  address:    z.string().trim().max(500).optional(),

  emergencyContact: z
    .string()
    .trim()
    .regex(/^\+?[\d\s\-().]{7,20}$/, 'Invalid phone number format')
    .optional(),

  vehicleId: z.string().uuid('vehicleId must be a valid UUID').optional(),
});

// ─── PATCH /drivers/:id ───────────────────────────────────────
export const updateDriverSchema = z
  .object({
    licenseNumber: z
      .string()
      .trim()
      .min(4)
      .max(50)
      .transform((v) => v.toUpperCase()),

    licenseClass:  licenseClassEnum,

    licenseExpiry: z.coerce.date(),

    experience:       z.number().int().min(0).max(60),
    address:          z.string().trim().max(500).nullable(),
    emergencyContact: z
      .string()
      .trim()
      .regex(/^\+?[\d\s\-().]{7,20}$/, 'Invalid phone number format')
      .nullable(),
  })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' },
  );

// ─── PATCH /drivers/:id/status ────────────────────────────────
export const updateDriverStatusSchema = z
  .object({
    status: driverStatusEnum,
    reason: z.string().trim().min(5).max(500).optional(),
  })
  .refine(
    (data) => data.status !== 'SUSPENDED' || !!data.reason,
    { message: 'A reason is required when suspending a driver', path: ['reason'] },
  );

// ─── PATCH /drivers/:id/vehicle ───────────────────────────────
export const assignVehicleSchema = z.object({
  vehicleId: z.string().uuid('vehicleId must be a valid UUID').nullable(),
});

// ─── POST /drivers/:id/safety-score ──────────────────────────
export const adjustSafetyScoreSchema = z.object({
  event: safetyEventEnum,
  notes: z.string().trim().max(500).optional(),
});

// ─── GET /drivers (query params) ─────────────────────────────
export const listDriversQuerySchema = z.object({
  page:         z.coerce.number().int().positive().default(1),
  limit:        z.coerce.number().int().positive().max(100).default(20),
  status:       driverStatusEnum.optional(),
  licenseClass: licenseClassEnum.optional(),
  vehicleId:    z.string().uuid().optional(),
  search:       z.string().trim().max(100).optional(),
  licenseExpiringSoon: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ─── Inferred types ───────────────────────────────────────────
export type CreateDriverInput       = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput       = z.infer<typeof updateDriverSchema>;
export type UpdateDriverStatusInput = z.infer<typeof updateDriverStatusSchema>;
export type AssignVehicleInput      = z.infer<typeof assignVehicleSchema>;
export type AdjustSafetyScoreInput  = z.infer<typeof adjustSafetyScoreSchema>;
export type ListDriversInput        = z.infer<typeof listDriversQuerySchema>;
