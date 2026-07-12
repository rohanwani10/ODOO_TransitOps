import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isPrismaNotFoundError(error: unknown) {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025";
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

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

            if (!["DRAFT", "DISPATCHED"].includes(currentTrip.status)) {
                throw new Error("TRIP_NOT_CANCELLABLE");
            }

            const updates: Array<Promise<unknown>> = [
                tx.trip.update({
                    where: { id },
                    data: {
                        status: "CANCELLED",
                        vehicle: { update: { status: "AVAILABLE" } },
                        driver: { update: { status: "AVAILABLE" } },
                    },
                    include: {
                        vehicle: true,
                        driver: true,
                    },
                }),
            ];

            return updates[0] as Promise<Awaited<ReturnType<typeof tx.trip.update>>>;
        });

        if (!trip) {
            return NextResponse.json({ error: "Trip not found" }, { status: 404 });
        }

        return NextResponse.json(trip);
    } catch (error) {
        if (isPrismaNotFoundError(error)) {
            return NextResponse.json({ error: "Trip not found" }, { status: 404 });
        }

        if (error instanceof Error && error.message === "TRIP_NOT_CANCELLABLE") {
            return NextResponse.json({ error: "Trip can only be cancelled while in DRAFT or DISPATCHED status" }, { status: 409 });
        }

        return NextResponse.json({ error: "Failed to cancel trip" }, { status: 500 });
    }
}