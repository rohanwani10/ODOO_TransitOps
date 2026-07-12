import "dotenv/config";

/**
 * TransitOps — Seed Script
 *
 * Run with: pnpm seed
 *
 * Creates a realistic dataset covering all models so that
 * Prisma Studio shows meaningful, relatable data.
 *
 * Import path: src/generated/prisma is the Prisma 7 output dir.
 * The path below resolves correctly from prisma/seed.ts.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import bcrypt from "bcrypt";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding TransitOps database…");

  await seedUsers();
  await seedVehicles();
  await seedDrivers();
  await seedTripsAndLogs();

  console.log("✅ Seed complete.");
}

// ---------------------------------------------------------------------------
// 1. Users
// ---------------------------------------------------------------------------

async function seedUsers() {
  console.log("  → Users");

  const users = [
    {
      email: "admin@transitops.com",
      name: "Arjun Sharma",
      role: "ADMIN" as const,
      plain: "Admin@123",
    },
    {
      email: "manager@transitops.com",
      name: "Priya Nair",
      role: "MANAGER" as const,
      plain: "Manager@123",
    },
    {
      email: "driver.rajesh@transitops.com",
      name: "Rajesh Kumar",
      role: "DRIVER" as const,
      plain: "Driver@123",
    },
    {
      email: "driver.suresh@transitops.com",
      name: "Suresh Patel",
      role: "DRIVER" as const,
      plain: "Driver@123",
    },
    {
      email: "driver.meena@transitops.com",
      name: "Meena Devi",
      role: "DRIVER" as const,
      plain: "Driver@123",
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: await hashPassword(u.plain),
        isActive: true,
      },
    });
  }
}


// ---------------------------------------------------------------------------
// 2. Vehicles
// ---------------------------------------------------------------------------

async function seedVehicles() {
  console.log("  → Vehicles");

  const vehicles = [
    {
      registrationNo: "MH12AB1234",
      make: "Tata",
      model: "Starbus Ultra",
      year: 2021,
      type: "BUS" as const,
      fuelType: "DIESEL" as const,
      status: "AVAILABLE" as const,
      odometerKm: 48200,
      seatingCapacity: 52,
      insurancePolicyNo: "ICICI-BUS-00123",
      insuranceExpiry: daysFromNow(180),
      registrationExpiry: daysFromNow(365),
    },
    {
      registrationNo: "MH12CD5678",
      make: "Ashok Leyland",
      model: "Stag",
      year: 2020,
      type: "BUS" as const,
      fuelType: "DIESEL" as const,
      status: "IN_USE" as const,
      odometerKm: 72100,
      seatingCapacity: 40,
      insurancePolicyNo: "HDFC-BUS-00456",
      insuranceExpiry: daysFromNow(90),
      registrationExpiry: daysFromNow(200),
    },
    {
      registrationNo: "MH12EF9012",
      make: "Force",
      model: "Traveller 17",
      year: 2022,
      type: "MINIBUS" as const,
      fuelType: "DIESEL" as const,
      status: "AVAILABLE" as const,
      odometerKm: 21500,
      seatingCapacity: 17,
      insurancePolicyNo: "NIC-VAN-00789",
      insuranceExpiry: daysFromNow(270),
      registrationExpiry: daysFromNow(400),
    },
    {
      registrationNo: "MH12GH3456",
      make: "Toyota",
      model: "Innova Crysta",
      year: 2023,
      type: "CAR" as const,
      fuelType: "PETROL" as const,
      status: "MAINTENANCE" as const,
      odometerKm: 15300,
      seatingCapacity: 7,
      insurancePolicyNo: "BAJ-CAR-01011",
      insuranceExpiry: daysFromNow(300),
      registrationExpiry: daysFromNow(600),
    },
    {
      registrationNo: "MH12IJ7890",
      make: "Mahindra",
      model: "Bolero Pickup",
      year: 2019,
      type: "TRUCK" as const,
      fuelType: "DIESEL" as const,
      status: "AVAILABLE" as const,
      odometerKm: 93800,
      seatingCapacity: null,
      insurancePolicyNo: "OIC-TRK-01213",
      insuranceExpiry: daysFromNow(60),
      registrationExpiry: daysFromNow(150),
    },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { registrationNo: v.registrationNo },
      update: {},
      create: v,
    });
  }
}


// ---------------------------------------------------------------------------
// 3. Drivers  (linked to DRIVER-role users)
// ---------------------------------------------------------------------------

async function seedDrivers() {
  console.log("  → Drivers");

  const driverUsers = await prisma.user.findMany({
    where: { role: "DRIVER" },
    orderBy: { createdAt: "asc" },
  });

  const driverData = [
    {
      licenseNo: "MH-1420210012345",
      licenseExpiry: daysFromNow(730),
      phone: "+91-9876543210",
      address: "12, Shivaji Nagar, Pune, MH 411005",
      dateOfBirth: new Date("1988-03-15"),
      status: "ACTIVE" as const,
      emergencyName: "Kavita Kumar",
      emergencyPhone: "+91-9876500001",
      hiredAt: new Date("2021-06-01"),
    },
    {
      licenseNo: "GJ-0120190054321",
      licenseExpiry: daysFromNow(400),
      phone: "+91-9765432109",
      address: "45, Gandhi Road, Ahmedabad, GJ 380001",
      dateOfBirth: new Date("1985-11-22"),
      status: "ACTIVE" as const,
      emergencyName: "Rekha Patel",
      emergencyPhone: "+91-9765400002",
      hiredAt: new Date("2020-02-15"),
    },
    {
      licenseNo: "DL-0120220098765",
      licenseExpiry: daysFromNow(1000),
      phone: "+91-9654321098",
      address: "78, Lajpat Nagar, New Delhi, DL 110024",
      dateOfBirth: new Date("1995-07-08"),
      status: "ACTIVE" as const,
      emergencyName: "Ramu Devi",
      emergencyPhone: "+91-9654300003",
      hiredAt: new Date("2022-09-10"),
    },
  ];

  for (let i = 0; i < driverUsers.length; i++) {
    const user = driverUsers[i];
    const data = driverData[i];
    if (!data) continue;

    await prisma.driver.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        ...data,
      },
    });
  }
}


// ---------------------------------------------------------------------------
// 4. Trips, MaintenanceLogs, FuelLogs, Expenses, AuditLogs
// ---------------------------------------------------------------------------

async function seedTripsAndLogs() {
  console.log("  → Trips, Maintenance, Fuel, Expenses, Audit logs");

  // Fetch inserted records for FK references
  const vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: "asc" } });
  const drivers = await prisma.driver.findMany({
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const adminUser = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const managerUser = await prisma.user.findFirstOrThrow({ where: { role: "MANAGER" } });

  const bus1 = vehicles[0];
  const bus2 = vehicles[1];
  const minibus = vehicles[2];
  const car = vehicles[3];
  const truck = vehicles[4];
  const driver1 = drivers[0];
  const driver2 = drivers[1];
  const driver3 = drivers[2];

  // ── Trips ────────────────────────────────────────────────────────────────

  // Completed trip — bus1 + driver1
  const trip1 = await prisma.trip.create({
    data: {
      vehicleId: bus1.id,
      driverId: driver1.id,
      origin: "Pune Central Depot",
      destination: "Nashik Bus Stand",
      scheduledStart: daysAgo(10),
      scheduledEnd: new Date(daysAgo(10).getTime() + 4 * 60 * 60 * 1000),
      actualStart: daysAgo(10),
      actualEnd: new Date(daysAgo(10).getTime() + 4.5 * 60 * 60 * 1000),
      startOdometer: 47800,
      endOdometer: 48200,
      distanceKm: 400,
      purpose: "Regular intercity passenger service",
      status: "COMPLETED",
    },
  });

  // In-progress trip — bus2 + driver2
  const trip2 = await prisma.trip.create({
    data: {
      vehicleId: bus2.id,
      driverId: driver2.id,
      origin: "Ahmedabad Central",
      destination: "Surat Bus Terminal",
      scheduledStart: daysAgo(0),
      scheduledEnd: new Date(Date.now() + 3 * 60 * 60 * 1000),
      actualStart: new Date(Date.now() - 1 * 60 * 60 * 1000),
      startOdometer: 71800,
      status: "IN_PROGRESS",
      purpose: "Express passenger service",
    },
  });

  // Scheduled trip — minibus + driver3
  const trip3 = await prisma.trip.create({
    data: {
      vehicleId: minibus.id,
      driverId: driver3.id,
      origin: "New Delhi Office HQ",
      destination: "IGI Airport T3",
      scheduledStart: daysFromNow(2),
      scheduledEnd: new Date(daysFromNow(2).getTime() + 1.5 * 60 * 60 * 1000),
      purpose: "Executive airport transfer",
      status: "SCHEDULED",
    },
  });

  // Cancelled trip — truck + driver1
  await prisma.trip.create({
    data: {
      vehicleId: truck.id,
      driverId: driver1.id,
      origin: "Pune Warehouse",
      destination: "Mumbai JNPT Port",
      scheduledStart: daysAgo(3),
      scheduledEnd: new Date(daysAgo(3).getTime() + 5 * 60 * 60 * 1000),
      purpose: "Cargo delivery — electronics",
      status: "CANCELLED",
      notes: "Cancelled due to port strike",
    },
  });

  // Completed trip — car + driver3
  const trip5 = await prisma.trip.create({
    data: {
      vehicleId: car.id,
      driverId: driver3.id,
      origin: "Delhi HQ",
      destination: "Gurugram Client Office",
      scheduledStart: daysAgo(5),
      scheduledEnd: new Date(daysAgo(5).getTime() + 1 * 60 * 60 * 1000),
      actualStart: daysAgo(5),
      actualEnd: new Date(daysAgo(5).getTime() + 1.25 * 60 * 60 * 1000),
      startOdometer: 15000,
      endOdometer: 15300,
      distanceKm: 300,
      purpose: "Client meeting drop-off",
      status: "COMPLETED",
    },
  });

  // ── Maintenance Logs ──────────────────────────────────────────────────────

  // Scheduled maintenance on car (currently in MAINTENANCE status)
  await prisma.maintenanceLog.create({
    data: {
      vehicleId: car.id,
      type: "SCHEDULED",
      status: "IN_PROGRESS",
      title: "30,000 km Service",
      description: "Oil change, filter replacement, brake inspection, tyre rotation",
      vendor: "Toyota Authorized Service Centre, Delhi",
      odometerKm: 15300,
      scheduledAt: daysAgo(1),
      cost: "8500.00",
    },
  });

  // Completed maintenance on bus1
  await prisma.maintenanceLog.create({
    data: {
      vehicleId: bus1.id,
      type: "SCHEDULED",
      status: "COMPLETED",
      title: "50,000 km Service",
      description: "Full service — engine tune-up, clutch inspection, AC regas",
      vendor: "Tata Motors Service, Pune",
      odometerKm: 46000,
      scheduledAt: daysAgo(30),
      completedAt: daysAgo(29),
      cost: "22000.00",
    },
  });

  // Emergency maintenance on bus2
  await prisma.maintenanceLog.create({
    data: {
      vehicleId: bus2.id,
      type: "EMERGENCY",
      status: "COMPLETED",
      title: "Tyre Blowout Repair",
      description: "Front left tyre replaced after blowout on highway",
      vendor: "MRF Tyre Centre, Vadodara",
      odometerKm: 70500,
      scheduledAt: daysAgo(15),
      completedAt: daysAgo(15),
      cost: "4200.00",
    },
  });

  // Upcoming scheduled on truck
  await prisma.maintenanceLog.create({
    data: {
      vehicleId: truck.id,
      type: "SCHEDULED",
      status: "SCHEDULED",
      title: "Quarterly Inspection",
      description: "Brake system, steering, lights and chassis inspection",
      vendor: "Mahindra Authorised Workshop, Pune",
      scheduledAt: daysFromNow(7),
      cost: "5000.00",
    },
  });

  // ── Fuel Logs ─────────────────────────────────────────────────────────────

  // Fuel fill for trip1 (completed)
  await prisma.fuelLog.create({
    data: {
      vehicleId: bus1.id,
      driverId: driver1.id,
      tripId: trip1.id,
      fuelType: "DIESEL",
      quantity: "120.50",
      pricePerUnit: "92.50",
      totalCost: "11146.25",
      odometerKm: 47850,
      station: "HP Petrol Pump, Nashik Highway",
      filledAt: daysAgo(10),
    },
  });

  // Fuel fill for in-progress trip2
  await prisma.fuelLog.create({
    data: {
      vehicleId: bus2.id,
      driverId: driver2.id,
      tripId: trip2.id,
      fuelType: "DIESEL",
      quantity: "95.00",
      pricePerUnit: "91.75",
      totalCost: "8716.25",
      odometerKm: 71900,
      station: "Indian Oil Outlet, Anand",
      filledAt: daysAgo(1),
    },
  });

  // Fuel fill for truck (standalone, no specific trip)
  await prisma.fuelLog.create({
    data: {
      vehicleId: truck.id,
      driverId: driver1.id,
      fuelType: "DIESEL",
      quantity: "60.00",
      pricePerUnit: "92.00",
      totalCost: "5520.00",
      odometerKm: 93500,
      station: "BPCL Pump, Pune Bypass",
      filledAt: daysAgo(7),
    },
  });

  // Fuel fill for trip5 (car, petrol)
  await prisma.fuelLog.create({
    data: {
      vehicleId: car.id,
      driverId: driver3.id,
      tripId: trip5.id,
      fuelType: "PETROL",
      quantity: "35.00",
      pricePerUnit: "96.72",
      totalCost: "3385.20",
      odometerKm: 15050,
      station: "Shell, Vasant Vihar, Delhi",
      filledAt: daysAgo(5),
    },
  });

  // ── Expenses ──────────────────────────────────────────────────────────────

  // Fuel expense (approved) — submitted by driver1
  await prisma.expense.create({
    data: {
      vehicleId: bus1.id,
      tripId: trip1.id,
      submittedById: driver1.user.id,
      category: "FUEL",
      amount: "11146.25",
      description: "Diesel fill at HP Pump — Nashik route",
      status: "APPROVED",
      reviewedById: managerUser.id,
      reviewNote: "Receipt verified",
      reviewedAt: daysAgo(8),
      incurredAt: daysAgo(10),
    },
  });

  // Toll expense (pending) — submitted by driver2
  await prisma.expense.create({
    data: {
      vehicleId: bus2.id,
      tripId: trip2.id,
      submittedById: driver2.user.id,
      category: "TOLL",
      amount: "380.00",
      description: "Ahmedabad–Surat expressway tolls",
      status: "PENDING",
      incurredAt: new Date(),
    },
  });

  // Insurance renewal expense (approved) — submitted by manager
  await prisma.expense.create({
    data: {
      vehicleId: bus2.id,
      submittedById: managerUser.id,
      category: "INSURANCE",
      amount: "45000.00",
      description: "Annual insurance renewal — policy HDFC-BUS-00456",
      status: "APPROVED",
      reviewedById: adminUser.id,
      reviewNote: "Policy document verified",
      reviewedAt: daysAgo(20),
      incurredAt: daysAgo(25),
    },
  });

  // Maintenance expense (rejected) — submitted by driver1
  await prisma.expense.create({
    data: {
      vehicleId: truck.id,
      submittedById: driver1.user.id,
      category: "MAINTENANCE",
      amount: "1200.00",
      description: "Unofficial roadside repair — brake pad",
      status: "REJECTED",
      reviewedById: managerUser.id,
      reviewNote: "Unauthorised vendor. Must use approved service centre.",
      reviewedAt: daysAgo(4),
      incurredAt: daysAgo(6),
    },
  });

  // Miscellaneous expense (pending) — submitted by driver3
  await prisma.expense.create({
    data: {
      vehicleId: car.id,
      tripId: trip5.id,
      submittedById: driver3.user.id,
      category: "MISCELLANEOUS",
      amount: "250.00",
      description: "Parking charges at Gurugram client office",
      status: "PENDING",
      incurredAt: daysAgo(5),
    },
  });

  // ── Audit Logs ────────────────────────────────────────────────────────────

  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: "CREATE",
        entity: "Vehicle",
        entityId: bus1.id,
        newValues: { registrationNo: bus1.registrationNo, status: "AVAILABLE" },
        ipAddress: "192.168.1.10",
      },
      {
        userId: adminUser.id,
        action: "CREATE",
        entity: "Vehicle",
        entityId: bus2.id,
        newValues: { registrationNo: bus2.registrationNo, status: "AVAILABLE" },
        ipAddress: "192.168.1.10",
      },
      {
        userId: managerUser.id,
        action: "UPDATE",
        entity: "Vehicle",
        entityId: bus2.id,
        oldValues: { status: "AVAILABLE" },
        newValues: { status: "IN_USE" },
        ipAddress: "192.168.1.15",
      },
      {
        userId: managerUser.id,
        action: "UPDATE",
        entity: "Vehicle",
        entityId: car.id,
        oldValues: { status: "AVAILABLE" },
        newValues: { status: "MAINTENANCE" },
        ipAddress: "192.168.1.15",
      },
      {
        userId: driver1.user.id,
        action: "CREATE",
        entity: "Trip",
        entityId: trip1.id,
        newValues: { origin: trip1.origin, destination: trip1.destination, status: "SCHEDULED" },
        ipAddress: "10.0.0.5",
      },
      {
        userId: driver1.user.id,
        action: "UPDATE",
        entity: "Trip",
        entityId: trip1.id,
        oldValues: { status: "IN_PROGRESS" },
        newValues: { status: "COMPLETED", endOdometer: 48200 },
        ipAddress: "10.0.0.5",
      },
      {
        userId: managerUser.id,
        action: "UPDATE",
        entity: "Expense",
        entityId: trip1.id, // references the expense conceptually
        oldValues: { status: "PENDING" },
        newValues: { status: "APPROVED" },
        ipAddress: "192.168.1.15",
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
