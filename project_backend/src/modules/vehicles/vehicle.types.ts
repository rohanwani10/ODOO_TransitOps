import type { VehicleStatus, VehicleType, FuelType } from '@prisma/client';

// ─── Core DTO ─────────────────────────────────────────────────
// Mirrors the Prisma Vehicle model, minus internal/relational fields.
// Used as the canonical response shape across all vehicle endpoints.
export interface VehicleDto {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  fuelType: FuelType;
  status: VehicleStatus;
  capacity: number;
  color: string | null;
  chassisNumber: string;
  engineNumber: string;
  insuranceExpiry: Date | null;
  permitExpiry: Date | null;
  fitnessExpiry: Date | null;
  odometer: number;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Request DTOs ─────────────────────────────────────────────
export interface CreateVehicleDto {
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  fuelType: FuelType;
  capacity: number;
  color?: string;
  chassisNumber: string;
  engineNumber: string;
  insuranceExpiry?: Date;
  permitExpiry?: Date;
  fitnessExpiry?: Date;
  imageUrl?: string;
}

export interface UpdateVehicleDto {
  make?: string;
  model?: string;
  year?: number;
  type?: VehicleType;
  fuelType?: FuelType;
  capacity?: number;
  color?: string;
  insuranceExpiry?: Date | null;
  permitExpiry?: Date | null;
  fitnessExpiry?: Date | null;
  imageUrl?: string | null;
}

export interface UpdateVehicleStatusDto {
  status: VehicleStatus;
  /** Required when transitioning to IN_SHOP — links this status
   *  change to the triggering maintenance record. */
  maintenanceId?: string;
}

export interface UpdateOdometerDto {
  odometer: number;
}

// ─── Query / Filter ───────────────────────────────────────────
export interface ListVehiclesQuery {
  page: number;
  limit: number;
  status?: VehicleStatus;
  type?: VehicleType;
  fuelType?: FuelType;
  search?: string; // matches registrationNumber, make, model
}

// ─── Paginated response wrapper ───────────────────────────────
export interface PaginatedVehicles {
  data: VehicleDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
