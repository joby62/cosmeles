import { NextRequest, NextResponse } from "next/server";
import { ADMIN_CONSOLE_COOKIE_NAME } from "@/lib/adminAuth";
import { buildExternalUrl } from "@/lib/requestOrigin";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(buildExternalUrl(req, "/auth"), 303);
  res.cookies.set({
    name: ADMIN_CONSOLE_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return res;
}
