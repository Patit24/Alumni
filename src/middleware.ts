import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Never intercept auth endpoints, OAuth callbacks, or API auth handlers
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  try {
    return await updateSession(request);
  } catch (e) {
    console.error("Middleware top-level error:", e);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static, _next/image, favicon.ico
     * - api/auth (auth routes must be handled directly by their route handlers)
     * - static image/asset extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
