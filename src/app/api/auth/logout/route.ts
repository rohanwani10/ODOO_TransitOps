import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/auth";

export async function POST() {
  await clearSessionCookies();
  return NextResponse.json({ success: true, message: "Logged out successfully" });
}
