import { NextResponse } from "next/server";
import { ADMIN_CONSOLE_COOKIE_NAME } from "@/lib/adminAuth";

export async function POST() {
  const res = NextResponse.redirect("/auth", 303);
  res.cookies.set({
    name: ADMIN_CONSOLE_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return res;
}
