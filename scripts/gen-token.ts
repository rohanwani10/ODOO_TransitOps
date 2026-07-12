/**
 * Gen-Token — Development helper to generate test JWTs
 *
 * Usage:
 *   npx tsx scripts/gen-token.ts
 *   npx tsx scripts/gen-token.ts --role ADMIN
 *   npx tsx scripts/gen-token.ts --role DRIVER --userId <id>
 *
 * The generated token can be used in curl / Postman:
 *   Authorization: Bearer <token>
 *
 * Token payload matches what auth middleware will expect when wired in:
 *   { id, email, role, iat, exp }
 */

import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const secret = process.env.JWT_SECRET;
const dbUrl = process.env.DATABASE_URL;

if (!secret) throw new Error("JWT_SECRET not set in .env");
if (!dbUrl) throw new Error("DATABASE_URL not set in .env");

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
});

async function main() {
    const args = process.argv.slice(2);
    const roleIndex = args.indexOf("--role");
    const userIdIndex = args.indexOf("--userId");

    const roleArg = roleIndex !== -1 ? (args[roleIndex + 1]?.toUpperCase() ?? "ADMIN") : "ADMIN";
    const userIdArg = userIdIndex !== -1 ? args[userIdIndex + 1] : undefined;

    let user: { id: string; email: string; name: string; role: string } | null = null;

    if (userIdArg) {
        user = await prisma.user.findUnique({
            where: { id: userIdArg },
            select: { id: true, email: true, name: true, role: true },
        });
        if (!user) throw new Error(`User with id=${userIdArg} not found`);
    } else {
        user = await prisma.user.findFirst({
            where: { role: roleArg as "ADMIN" | "MANAGER" | "DRIVER" },
            select: { id: true, email: true, name: true, role: true },
        });
        if (!user) throw new Error(`No user found with role=${roleArg}. Run pnpm db:seed first.`);
    }

    const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };

    const expiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as import("ms").StringValue;
    // Non-null assertion: secret is guaranteed non-empty by the guard at module level.
    // TypeScript cannot narrow module-level `const` across function call boundaries.
    const token = jwt.sign(payload, secret!, { expiresIn });

    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║       TransitOps — Test JWT Token        ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log(`\nUser  : ${user.name} <${user.email}>`);
    console.log(`Role  : ${user.role}`);
    console.log(`UserId: ${user.id}`);
    console.log(`\nToken :\n`);
    console.log(`Bearer ${token}`);
    // Derive the expiry display from the actual setting rather than hardcoding 7d.
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresDisplay = decoded?.exp
        ? new Date(decoded.exp * 1000).toISOString()
        : `(based on ${expiresIn})`;
    console.log(`\nExpires: ${expiresDisplay}`);
    console.log("\n--- curl example ---");
    console.log(`curl http://localhost:3000/api/fuel-logs \\`);
    console.log(`  -H "Authorization: Bearer ${token}"\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
