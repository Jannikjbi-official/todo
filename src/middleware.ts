import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    console.log("[MIDDLEWARE] Request path:", req.nextUrl.pathname);
    console.log("[MIDDLEWARE] Token sub:", req.nextauth.token?.sub);
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isAuth = !!token;
        console.log("[MIDDLEWARE] Authorized callback:", { path: req.nextUrl.pathname, isAuth });
        return isAuth;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
