import { NextRequest, NextResponse } from "next/server";

function isMobileUA(ua: string) {
  // 足够用的 heuristic（先 MVP，后面可加 iPad 是否算 desktop 等策略）
  return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 不处理 Next 内部、静态、API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap")
  ) {
    return NextResponse.next();
  }

  // 已经在 mobile 栈里就不改
  if (pathname.startsWith("/m")) {
    return NextResponse.next();
  }

  const ua = req.headers.get("user-agent") || "";
  if (!isMobileUA(ua)) {
    return NextResponse.next();
  }

  // ✅ 手机：/xxx => /m/xxx（根路径 / => /m）
  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/m" : `/m${pathname}`;
  url.search = search;
  return NextResponse.redirect(url, 302);
}

// 只匹配页面路由（排除静态资源的更稳写法也可，但上面已手动 return）
export const config = {
  matcher: ["/((?!_next|api|images|favicon.ico).*)"],
};