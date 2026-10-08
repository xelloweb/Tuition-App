/**
 * Server-only protections for the public parent form. The form is an untrusted
 * entry point: it can only create intake submissions, never read anything.
 */
import crypto from "node:crypto";
import { getAuthSecret } from "./auth-options";
import { ApiError } from "./api-errors";

/** A form must be open this long before it can be sent (bots post instantly). */
export const MIN_FILL_MS = 3_000;
/** Forms older than this ask for a fresh token (the form keeps what was typed). */
export const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const MAX_BODY_BYTES = 32 * 1024;

const tokenKey = () => crypto.createHmac("sha256", getAuthSecret()).update("xello-admission-form-v1").digest();

/** "<issuedAt>.<nonce>.<signature>": proves the form came from this site and when. */
export function issueFormToken(now = Date.now()): string {
  const payload = `${now}.${crypto.randomBytes(9).toString("base64url")}`;
  const signature = crypto.createHmac("sha256", tokenKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export type TokenCheck = "ok" | "invalid" | "too_fast" | "expired";

export function checkFormToken(token: unknown, now = Date.now()): TokenCheck {
  if (typeof token !== "string" || token.length > 200) return "invalid";
  const parts = token.split(".");
  if (parts.length !== 3) return "invalid";
  const [issued, nonce, signature] = parts;
  const expected = crypto.createHmac("sha256", tokenKey()).update(`${issued}.${nonce}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return "invalid";
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60_000) return "invalid";
  if (now - issuedAt < MIN_FILL_MS) return "too_fast";
  if (now - issuedAt > TOKEN_MAX_AGE_MS) return "expired";
  return "ok";
}

/**
 * In-memory limits (one Node process serves the site). Keys are hashes of the
 * client address and are never stored or logged.
 */
const WINDOWS = [
  { ms: 10 * 60 * 1000, perClient: 5 },
  { ms: 24 * 60 * 60 * 1000, perClient: 20 },
];
const GLOBAL_PER_HOUR = 200;
const hits = new Map<string, number[]>();
let globalHits: number[] = [];

/**
 * The hosting proxy appends the real client address to X-Forwarded-For, so the
 * last entry is used (earlier entries can be typed by anyone).
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean).pop();
  const address = forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
  return crypto.createHash("sha256").update(`xello-intake:${address}`).digest("hex").slice(0, 32);
}

/** Records an attempt; returns false when the client (or the site overall) is over the limit. */
export function allowSubmission(key: string, now = Date.now()): boolean {
  const longest = Math.max(...WINDOWS.map((w) => w.ms));
  const recent = (hits.get(key) ?? []).filter((t) => now - t < longest);
  globalHits = globalHits.filter((t) => now - t < 60 * 60 * 1000);
  const overClient = WINDOWS.some((w) => recent.filter((t) => now - t < w.ms).length >= w.perClient);
  if (overClient || globalHits.length >= GLOBAL_PER_HOUR) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  globalHits.push(now);
  if (hits.size > 10_000) {
    for (const [k, times] of hits) if (!times.some((t) => now - t < longest)) hits.delete(k);
  }
  return true;
}

/** For tests only. */
export function resetRateLimits() {
  hits.clear();
  globalHits = [];
}

/** Rejects posts from other websites (the form only posts JSON from this site). */
export function assertSameSite(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; the form token still applies
  const allowed = new Set<string>();
  const configured = process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // ignore a malformed setting
    }
  }
  const host = req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(req.url).protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  if (!allowed.has(origin)) throw new ApiError(403, "FORBIDDEN", "This form can only be sent from the Xello Tuition website.");
}

/** Reads at most MAX_BODY_BYTES of JSON; larger requests are refused unread. */
export async function readLimitedJson(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new ApiError(400, "INVALID_JSON", "The form could not be read. Refresh the page and try again.");
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new ApiError(413, "VALIDATION_FAILED", "The form is too large. Shorten the longer answers and try again.");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON", "The form could not be read. Refresh the page and try again.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "VALIDATION_FAILED", "The form is too large. Shorten the longer answers and try again.");
    }
    chunks.push(value);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ApiError(400, "INVALID_JSON", "The form could not be read. Refresh the page and try again.");
}

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // no 0/O, 1/I/L or U

/** Random, non-sequential reference such as "XA-7K3M-9QPD" (about 39 bits). */
export function newReference(): string {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length]).join("");
  return `XA-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

/**
 * The approved privacy notice (PRIVACY_NOTICE_URL): an https address or a path on
 * this site. Without it the public form must not launch.
 */
export function privacyNoticeUrl(): string | null {
  const value = process.env.PRIVACY_NOTICE_URL?.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** In production the form only accepts submissions once the privacy notice is configured. */
export function intakeOpen(): { open: boolean; preview: boolean } {
  const configured = Boolean(privacyNoticeUrl());
  if (configured) return { open: true, preview: false };
  return process.env.NODE_ENV === "production" ? { open: false, preview: false } : { open: true, preview: true };
}

export const todayInIst = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
