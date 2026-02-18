import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const isAuthPage =
    req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register";

  // If user is logged in
  if (isLoggedIn) {
    // Redirect to dashboard if trying to access auth pages or root
    if (isAuthPage || req.nextUrl.pathname === "/") {
      return Response.redirect(new URL("/dashboard", req.nextUrl));
    }
    // Allow access to other protected routes
    return;
  }

  // If user is NOT logged in
  if (!isLoggedIn) {
    // Allow access to auth pages
    if (isAuthPage) {
      return;
    }
    // Redirect all other routes to login
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  return;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     * - svg (public svgs)
     * - uploads (public uploads)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|images|svg|uploads).*)",
  ],
};
