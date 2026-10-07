import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

function getDatabaseUrl() {
  // If user provides a remote database URL (e.g. Postgres, Neon, Supabase)
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:")) {
    return process.env.DATABASE_URL;
  }

  // When running on Vercel Serverless. Vercel sets VERCEL=1; any other value
  // (e.g. VERCEL="false" copied into another host's env) must not trigger this.
  if (process.env.VERCEL === "1") {
    // Each serverless instance works on its own temporary copy of the bundled
    // file: writes are not shared between instances and are lost on cold start.
    console.warn(
      "[xello] DATABASE_URL is a SQLite file on Vercel. Data written here is temporary and per-instance. Configure a PostgreSQL DATABASE_URL before entering real data."
    );
    const tmpDbPath = "/tmp/dev.db";
    const bundledDbPath = path.join(process.cwd(), "prisma", "dev.db");

    if (fs.existsSync(bundledDbPath)) {
      try {
        if (!fs.existsSync(tmpDbPath) || fs.statSync(bundledDbPath).mtimeMs > fs.statSync(tmpDbPath).mtimeMs) {
          fs.copyFileSync(bundledDbPath, tmpDbPath);
        }
      } catch (err) {
        console.error("Failed to copy bundled SQLite to /tmp:", err);
      }
    }
    return `file:${tmpDbPath}`;
  }

  return process.env.DATABASE_URL || "file:./dev.db";
}

const dbUrl = getDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** True when running on Vercel against the bundled SQLite file (non-persistent). */
export const isEphemeralDatabase =
  process.env.VERCEL === "1" && !(process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:"));

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: dbUrl,
    // Prisma's own error log prints query arguments (personal data); outside local
    // development we rely on the sanitized logging in api-errors.ts instead.
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

