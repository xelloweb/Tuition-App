import { withAuth } from "next-auth/middleware";

// Next.js 16 name for middleware (runs on the Node.js runtime). Signed-out page
// visits are sent to /login. API routes are excluded on purpose: each handler
// calls requireUser() and answers 401 JSON, which the screens show as
// "session expired" instead of receiving an HTML login page.
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/((?!api/|login|forgot-password|setup-password|_next/static|_next/image|favicon.ico).*)"],
};
