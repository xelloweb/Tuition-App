import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * SHA-256 of secrets that have been published in this repository (the old
 * .env.example value and the old hard-coded fallback). Anyone with access to
 * the repo could forge sessions with them, so production refuses them.
 */
const PUBLISHED_SECRET_HASHES = new Set([
  "1ccf61c5ee039472abed666a10bdec52faf1529bfdf02c72364103052e97d050",
  "12d01622bc5f7c566f8cc5cac2aa691629c6f9af666d085c5aeb6bc331bbbdc0",
]);

function isPublishedSecret(secret: string): boolean {
  return PUBLISHED_SECRET_HASHES.has(createHash("sha256").update(secret).digest("hex"));
}

/**
 * The secret signs every session cookie. In production it must be set, long
 * and unique; a missing or published secret would let anyone mint an owner session.
 */
export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim() ?? "";
  if (process.env.NODE_ENV === "production") {
    if (secret.length < 32 || isPublishedSecret(secret)) {
      throw new Error(
        "NEXTAUTH_SECRET is missing, too short or publicly known. Generate a new one (e.g. `openssl rand -base64 32`) and set it in the hosting environment."
      );
    }
    return secret;
  }
  return secret || "local-development-only-secret-not-for-production";
}

/** Shared demo password for seeded accounts: local development only, and only when explicitly enabled. */
function demoLoginAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_LOGIN === "true";
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) {
          throw new Error("Enter your email and password.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) {
          throw new Error("Invalid email or password.");
        }

        if (!user.passwordHash) {
          if (demoLoginAllowed() && password === "demo123" && user.role !== "TEACHER") {
            return { id: user.id, name: user.name, email: user.email, role: user.role, teacherId: user.teacherId };
          }
          throw new Error("This account has no password yet. Use your invitation link to set one.");
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid email or password.");
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role, teacherId: user.teacherId };
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
        const u = user as { id: string; role?: string; teacherId?: string | null };
        token.id = u.id;
        token.role = u.role;
        token.teacherId = u.teacherId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const s = session.user as { id?: string; role?: string; teacherId?: string | null };
        s.id = token.id as string;
        s.role = token.role as string;
        s.teacherId = (token.teacherId as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: getAuthSecret(),
};
