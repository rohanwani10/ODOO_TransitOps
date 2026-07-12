import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

            if (currentTrip.status !== "DISPATCHED") {
                throw new Error("TRIP_NOT_DISPATCHED");
            }

            if (currentTrip.vehicle.status !== "ON_TRIP") {
                throw new Error("VEHICLE_NOT_ON_TRIP");
            }

            if (currentTrip.driver.status !== "ON_TRIP") {
                throw new Error("DRIVER_NOT_ON_TRIP");
            }

            return tx.trip.update({
                where: { id },
                data: {
                    status: "COMPLETED",
                    completedAt: now,
                    actualEnd: currentTrip.actualEnd ?? now,
                    vehicle: { update: { status: "AVAILABLE" } },
                    driver: { update: { status: "AVAILABLE" } },
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
                TRIP_NOT_DISPATCHED: "Trip must be in DISPATCHED status",
                VEHICLE_NOT_ON_TRIP: "Vehicle must be ON_TRIP",
                DRIVER_NOT_ON_TRIP: "Driver must be ON_TRIP",
            };

            const message = messageMap[error.message];

            if (message) {
                return NextResponse.json({ error: message }, { status: 409 });
            }
        }

        return NextResponse.json({ error: "Failed to complete trip" }, { status: 500 });
    }
}