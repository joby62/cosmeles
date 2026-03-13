import { NextRequest, NextResponse } from "next/server";
import { ADMIN_CONSOLE_COOKIE_NAME } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/auth", req.url), 303);
  res.cookies.set({
    name: ADMIN_CONSOLE_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return res;
}
