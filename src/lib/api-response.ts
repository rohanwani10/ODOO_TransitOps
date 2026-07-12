import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Standard API response envelope matching SRS §7
// { "success": true,  "data": {...}, "meta": {...} }
// { "success": false, "error": { "code": "...", "message": "...", "fields": {...} } }
// ---------------------------------------------------------------------------

export type ApiMeta = {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
};

export type ApiErrorCode =
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "FUTURE_DATE"
    | "INVALID_STATE"
    | "FORBIDDEN"
    | "AUTH_REQUIRED"
    | "INTERNAL_ERROR"
    | "DUPLICATE"
    | "FK_VIOLATION"
    | "INVALID_TRANSITION";

// Success response
export function successResponse<T>(
    data: T,
    meta?: ApiMeta,
    status = 200,
): NextResponse {
    return NextResponse.json(
        { success: true, data, ...(meta ? { meta } : {}) },
        { status },
    );
}

// Created response (201)
export function createdResponse<T>(data: T): NextResponse {
    return NextResponse.json({ success: true, data }, { status: 201 });
}

// No content (204)
export function noContentResponse(): NextResponse {
    return new NextResponse(null, { status: 204 });
}

// Error response
export function errorResponse(
    code: ApiErrorCode,
    message: string,
    status: number,
    fields?: Record<string, string | string[]>,
): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: {
                code,
                message,
                ...(fields ? { fields } : {}),
            },
        },
        { status },
    );
}

// Convenience helpers
export const Errors = {
    notFound: (resource: string) =>
        errorResponse("NOT_FOUND", `${resource} not found`, 404),

    conflict: (message: string) =>
        errorResponse("CONFLICT", message, 409),

    invalidJson: () =>
        errorResponse("VALIDATION_ERROR", "Invalid JSON body", 400),

    validation: (message: string, fields?: Record<string, string | string[]>) =>
        errorResponse("VALIDATION_ERROR", message, 422, fields),

    futureDate: (field: string) =>
        errorResponse(
            "FUTURE_DATE",
            `${field} cannot be a future date`,
            422,
            { [field]: "Cannot be a future date" },
        ),

    invalidState: (message: string) =>
        errorResponse("INVALID_STATE", message, 409),

    internal: () =>
        errorResponse("INTERNAL_ERROR", "Something went wrong, please try again", 500),
};
