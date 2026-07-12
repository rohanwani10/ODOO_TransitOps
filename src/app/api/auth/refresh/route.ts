import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifyRefreshToken,
  signAccessToken,
  createSessionCookies,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: "No refresh token provided" },
        { status: 401 }
      );
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    // Omit generic properties from JWT
    const { iat, exp, ...userData } = payload as any;

    const newAccessToken = await signAccessToken(userData);
    
    // Rotate cookies
    await createSessionCookies(newAccessToken, refreshToken);

    return NextResponse.json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
