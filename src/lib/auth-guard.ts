import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies, verifyAccessToken, SessionPayload } from "./auth";
import { hasPermission, Resource, Action } from "./rbac";

type HandlerFunc = (req: NextRequest, ctx?: any) => Promise<NextResponse> | NextResponse;
type HandlerWithUserFunc = (req: NextRequest & { user?: SessionPayload }, ctx?: any) => Promise<NextResponse> | NextResponse;

/**
 * Extracts and verifies the user session from the request.
 * Checks both Authorization header (Bearer) and session cookies.
 */
async function authenticateRequest(req: NextRequest): Promise<SessionPayload | null> {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);
    if (payload) return payload;
  }

  // Fallback to cookie
  const payloadFromCookie = await getSessionFromCookies();
  return payloadFromCookie;
}

/**
 * Higher-order function to protect API routes with authentication.
 */
export function withAuth(handler: HandlerWithUserFunc) {
  return async (req: NextRequest, ctx: any) => {
    const user = await authenticateRequest(req);
    
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Attach user to request object
    const reqWithUser = req as NextRequest & { user: SessionPayload };
    reqWithUser.user = user;

    return handler(reqWithUser, ctx);
  };
}

/**
 * Higher-order function to protect API routes with RBAC (Role-Based Access Control).
 */
export function withRBAC(resource: Resource, action: Action, handler: HandlerWithUserFunc) {
  return async (req: NextRequest, ctx: any) => {
    const user = await authenticateRequest(req);
    
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, resource, action)) {
      return NextResponse.json(
        { success: false, error: `Forbidden: requires '${action}' permission on '${resource}'` },
        { status: 403 }
      );
    }

    // Attach user to request object
    const reqWithUser = req as NextRequest & { user: SessionPayload };
    reqWithUser.user = user;

    return handler(reqWithUser, ctx);
  };
}
