// ---------------------------------------------------------------------------
// Prisma error code → friendly HTTP response mapper
// ---------------------------------------------------------------------------

export type PrismaKnownError = Error & { code?: string; meta?: Record<string, unknown> };

export function isPrismaError(error: unknown): error is PrismaKnownError {
    return (
        error instanceof Error &&
        "code" in error &&
        typeof (error as PrismaKnownError).code === "string"
    );
}

/** P2002 — Unique constraint violation */
export function isUniqueConstraintError(error: unknown): boolean {
    return isPrismaError(error) && (error as PrismaKnownError).code === "P2002";
}

/** P2003 — Foreign key constraint violation */
export function isForeignKeyError(error: unknown): boolean {
    return isPrismaError(error) && (error as PrismaKnownError).code === "P2003";
}

/** P2025 — Record not found (update/delete on non-existent row) */
export function isNotFoundError(error: unknown): boolean {
    return isPrismaError(error) && (error as PrismaKnownError).code === "P2025";
}

/**
 * Extract which field caused a unique constraint violation.
 * Prisma puts the field names in error.meta.target.
 */
export function getUniqueConstraintField(error: unknown): string | null {
    if (!isUniqueConstraintError(error)) return null;
    const meta = (error as PrismaKnownError).meta;
    if (!meta) return null;
    const target = meta.target;
    if (Array.isArray(target)) return target.join(", ");
    if (typeof target === "string") return target;
    return null;
}
