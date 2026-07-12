import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";

export const GET = withAuth(async (req) => {
  return NextResponse.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});
