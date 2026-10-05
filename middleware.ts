import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/canvas-runtime/index-embedded.html") {
    return NextResponse.rewrite(new URL("/canvas-paused", request.url));
  }

  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: ["/canvas-runtime", "/canvas-runtime/:path*"],
};
