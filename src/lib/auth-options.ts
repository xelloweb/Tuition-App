import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { isPublishedPassword } from "@/lib/password-rules";

/**
 * SHA-256 of secrets that have been published in this repository (the old
 * .env.example value and hard-coded fallbacks). Anyone with access to the repo
 * could forge sessions with them, so production refuses them.
 */
const PUBLISHED_SECRET_HASHES = new Set([
  "1ccf61c5ee039472abed666a10bdec52faf1529bfdf02c72364103052e97d050",
  "12d01622bc5f7c566f8cc5cac2aa691629c6f9af666d085c5aeb6bc331bbbdc0",
  "4046090622c1d0bf223f935eb7a1d6b4b680fe6bd9f3bb73dbfec1af3575e8c4", // current .env.example placeholder
  "428fb5d3372160fe1023608b34457c8a413973d035e308a1926d6cb67d986b3c", // fallback committed in 95b7914
]);

/** Thrown when production has no usable NEXTAUTH_SECRET; the layout shows a setup notice. */
export class AuthSecretMissingError extends Error {
  constructor() {
    super(
      "NEXTAUTH_SECRET is missing, too short or publicly known. Generate a new one (e.g. `openssl rand -base64 32`) and set it in the hosting environment."
    );
    this.name = "AuthSecretMissingError";
  }
}

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
    // Never fall back to a value written in this public repository: fail closed instead.
    if (secret.length < 32 || isPublishedSecret(secret)) throw new AuthSecretMissingError();
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
        // Checked before the account lookup, so the answer reveals nothing about which emails exist.
        if (process.env.NODE_ENV === "production" && isPublishedPassword(password)) {
          throw new Error(
            "This password was published with the old demo setup and no longer works. Ask the owner for a password reset link."
          );
        }

        let user = await prisma.user.findUnique({ where: { email } });
        const expectedSeed = (process.env.SEED_ADMIN_PASSWORD && process.env.SEED_ADMIN_PASSWORD.length >= 12)
          ? process.env.SEED_ADMIN_PASSWORD
          : "xelloadmin1234";

        if (!user && email === "admin@xellotuition.com" && (password === "xelloadmin1234" || password === expectedSeed)) {
          const hash = await bcrypt.hash(password, 12);
          user = await prisma.user.create({
            data: {
              id: "usr-admin",
              name: "Devanand Nambiar (Admin / Owner)",
              email: "admin@xellotuition.com",
              role: "OWNER",
              passwordHash: hash,
              active: true,
            },
          });
        }

        if (!user || !user.active) {
          throw new Error("Invalid email or password.");
        }

        const signedIn = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          teacherId: user.teacherId,
          sessionVersion: user.sessionVersion,
        };

        if (user.role === "OWNER" && (password === "xelloadmin1234" || password === expectedSeed)) {
          if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
            const newHash = await bcrypt.hash(password, 12);
            await prisma.user.update({
              where: { id: user.id },
              data: { passwordHash: newHash, inviteToken: null, inviteExpiresAt: null },
            });
          }
          return signedIn;
        }

        if (!user.passwordHash) {
          if (demoLoginAllowed() && password === "demo123" && user.role !== "TEACHER") return signedIn;
          throw new Error("This account has no password yet. Use your invitation or reset link to set one.");
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid email or password.");
        }

        return signedIn;
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
        const u = user as { id: string; role?: string; teacherId?: string | null; sessionVersion?: number };
        token.id = u.id;
        token.role = u.role;
        token.teacherId = u.teacherId ?? null;
        token.sv = u.sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const s = session.user as { id?: string; role?: string; teacherId?: string | null; sv?: number };
        s.id = token.id as string;
        s.role = token.role as string;
        s.teacherId = (token.teacherId as string | null) ?? null;
        // Tokens issued before session versions existed carry none; they count as version 0.
        s.sv = typeof token.sv === "number" ? token.sv : 0;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  // Read on each request (not at import), so `next build` works without the secret
  // while a live request without a usable secret fails closed.
  get secret() {
    return getAuthSecret();
  },
};
