import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.active) {
          throw new Error("Invalid credentials or deactivated account");
        }

        // Allow fallback for demo users if they have no password set
        if (!user.passwordHash) {
          if (credentials.password === "demo123" && user.role !== "TEACHER") {
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              teacherId: user.teacherId,
            };
          }
          throw new Error("Please set up your password via an invitation link.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          teacherId: user.teacherId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.teacherId = (user as any).teacherId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).teacherId = token.teacherId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-key-1234",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
