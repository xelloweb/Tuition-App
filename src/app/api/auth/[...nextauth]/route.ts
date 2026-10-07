import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Route files may only export HTTP handlers and route config, so the options
// live in src/lib/auth-options.ts (exporting them here broke `next build`).
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
