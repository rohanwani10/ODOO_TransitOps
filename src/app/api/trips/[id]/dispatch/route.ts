import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TripStatus } from "@/generated/prisma/client";

const ACTIVE_TRIP_STATUSES: TripStatus[] = ["DISPATCHED", "IN_PROGRESS"];

function isPrismaNotFoundError(error: unknown) {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025";
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const now = new Date();

    try {
        const trip = await prisma.$transaction(async (tx) => {
            const currentTrip = await tx.trip.findUnique({
                where: { id },
                include: {
                    vehicle: true,
                    driver: true,
                },
            });

            if (!currentTrip) {
                return null;
            }

            if (currentTrip.status !== "DRAFT") {
                throw new Error("TRIP_NOT_DRAFT");
            }

            if (currentTrip.vehicle.status !== "AVAILABLE") {
                throw new Error("VEHICLE_NOT_AVAILABLE");
            }

            if (currentTrip.driver.status === "SUSPENDED") {
                throw new Error("DRIVER_SUSPENDED");
            }

            if (currentTrip.driver.status !== "AVAILABLE") {
                throw new Error("DRIVER_NOT_AVAILABLE");
            }

            if (currentTrip.driver.licenseExpiry < now) {
                throw new Error("DRIVER_LICENSE_EXPIRED");
            }

            if (currentTrip.cargoWeightKg == null) {
                throw new Error("CARGO_WEIGHT_REQUIRED");
            }

            if (currentTrip.vehicle.payloadCapacityKg == null) {
                throw new Error("VEHICLE_CAPACITY_REQUIRED");
            }

            if (currentTrip.cargoWeightKg > currentTrip.vehicle.payloadCapacityKg) {
                throw new Error("CARGO_EXCEEDS_CAPACITY");
            }

            const [vehicleConflict, driverConflict] = await Promise.all([
                tx.trip.count({
                    where: {
                        vehicleId: currentTrip.vehicleId,
                        id: { not: currentTrip.id },
                        status: { in: ACTIVE_TRIP_STATUSES },
                    },
                }),
                tx.trip.count({
                    where: {
                        driverId: currentTrip.driverId,
                        id: { not: currentTrip.id },
                        status: { in: ACTIVE_TRIP_STATUSES },
                    },
                }),
            ]);

            if (vehicleConflict > 0) {
                throw new Error("VEHICLE_ALREADY_HAS_ACTIVE_TRIP");
            }

            if (driverConflict > 0) {
                throw new Error("DRIVER_ALREADY_HAS_ACTIVE_TRIP");
            }

            return tx.trip.update({
                where: { id },
                data: {
                    status: "DISPATCHED",
                    dispatchedAt: now,
                    vehicle: { update: { status: "ON_TRIP" } },
                    driver: { update: { status: "ON_TRIP" } },
                },
                include: {
                    vehicle: true,
                    driver: true,
                },
            });
        });

        if (!trip) {
            return NextResponse.json({ error: "Trip not found" }, { status: 404 });
        }

        return NextResponse.json(trip);
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return NextResponse.json({ error: "Trip not found" }, { status: 404 });
        }

        if (error instanceof Error) {
            const messageMap: Record<string, string> = {
                TRIP_NOT_DRAFT: "Trip must be in DRAFT status",
                VEHICLE_NOT_AVAILABLE: "Vehicle must be AVAILABLE",
                DRIVER_SUSPENDED: "Driver must not be suspended",
                DRIVER_NOT_AVAILABLE: "Driver must be AVAILABLE",
                DRIVER_LICENSE_EXPIRED: "Driver license must not be expired",
                CARGO_WEIGHT_REQUIRED: "Cargo weight is required to dispatch the trip",
                VEHICLE_CAPACITY_REQUIRED: "Vehicle payload capacity is required to dispatch the trip",
                CARGO_EXCEEDS_CAPACITY: "Cargo weight must not exceed vehicle capacity",
                VEHICLE_ALREADY_HAS_ACTIVE_TRIP: "Vehicle must not already have another ACTIVE trip",
                DRIVER_ALREADY_HAS_ACTIVE_TRIP: "Driver must not already have another ACTIVE trip",
            };

            const message = messageMap[error.message];

            if (message) {
                return NextResponse.json({ error: message }, { status: 409 });
            }
        }

        return NextResponse.json({ error: "Failed to dispatch trip" }, { status: 500 });
    }
}