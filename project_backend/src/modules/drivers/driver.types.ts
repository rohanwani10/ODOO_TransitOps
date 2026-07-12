import type { DriverStatus, LicenseClass } from '@prisma/client';

// ─── Embedded user summary (joined on every driver response) ──
export interface DriverUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

// ─── Embedded vehicle summary ─────────────────────────────────
export interface DriverVehicleSummary {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
}

// ─── Core DTO ─────────────────────────────────────────────────
export interface DriverDto {
  id: string;
  userId: string;
  user: DriverUserSummary;
  vehicleId: string | null;
  vehicle: DriverVehicleSummary | null;
  licenseNumber: string;
  licenseClass: LicenseClass;
  licenseExpiry: Date;
  licenseStatus: LicenseStatus;   // derived — not stored in DB
  status: DriverStatus;
  experience: number;
  address: string | null;
  emergencyContact: string | null;
  rating: number;
  safetyScore: number;
  totalTrips: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Derived license status (computed in service) ─────────────
export type LicenseStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

// ─── Safety score event type (used for score recalculation) ───
export type SafetyEvent =
  | 'TRIP_COMPLETED_ON_TIME'
  | 'TRIP_COMPLETED_LATE'
  | 'TRIP_CANCELLED'
  | 'INCIDENT_REPORTED'
  | 'LICENSE_EXPIRED'
  | 'SUSPENSION';

// ─── Request DTOs ─────────────────────────────────────────────
export interface CreateDriverDto {
  userId: string;
  licenseNumber: string;
  licenseClass: LicenseClass;
  licenseExpiry: Date;
  experience?: number;
  address?: string;
  emergencyContact?: string;
  vehicleId?: string;
}

export interface UpdateDriverDto {
  licenseNumber?: string;
  licenseClass?: LicenseClass;
  licenseExpiry?: Date;
  experience?: number;
  address?: string;
  emergencyContact?: string;
}

export interface UpdateDriverStatusDto {
  status: DriverStatus;
  reason?: string;   // required when suspending
}

export interface AssignVehicleDto {
  vehicleId: string | null;   // null = unassign
}

export interface AdjustSafetyScoreDto {
  event: SafetyEvent;
  notes?: string;
}

// ─── Query / Filter ───────────────────────────────────────────
export interface ListDriversQuery {
  page: number;
  limit: number;
  status?: DriverStatus;
  licenseClass?: LicenseClass;
  vehicleId?: string;
  search?: string;          // matches name, email, licenseNumber
  licenseExpiringSoon?: boolean;
}

// ─── Paginated response wrapper ───────────────────────────────
export interface PaginatedDrivers {
  data: DriverDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Stats ────────────────────────────────────────────────────
export interface DriverStats {
  byStatus: Record<DriverStatus, number>;
  total: number;
  licenseExpiringSoon: number;
  licenseExpired: number;
  averageSafetyScore: number;
}
