import { auth } from "@/auth";

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const userId = request.auth?.user?.id;
  const isAuthenticated = typeof userId === "string" && userId.length > 0;

  if (isAuthenticated && (isAuthPage || pathname === "/")) {
    return Response.redirect(new URL("/dashboard", request.nextUrl));
  }

  if (!isAuthenticated && !isAuthPage) {
    return Response.redirect(new URL("/login", request.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|images|svg|uploads).*)",
  ],
};
