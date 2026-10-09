import { encode, decode } from "next-auth/jwt";
import { getAuthSecret } from "./auth-options";
import { userForSession } from "./auth";
import { ApiError, forbiddenError } from "./api-errors";
import { CurrentUser } from "./types";

/** Phone app sign-ins last as long as website sessions. */
const MOBILE_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * The phone app sends `Authorization: Bearer <token>`. The token is signed and
 * encrypted with NEXTAUTH_SECRET, like the website session cookie, so it cannot
 * be forged or edited on the phone.
 */
export async function issueMobileToken(user: { id: string; sessionVersion: number }): Promise<string> {
  return encode({
    token: { id: user.id, sv: user.sessionVersion, kind: "mobile" },
    secret: getAuthSecret(),
    maxAge: MOBILE_TOKEN_MAX_AGE,
  });
}

/**
 * For /api/mobile routes: the signed-in account, re-read from the database on
 * every request (a deactivated account, changed role or password change takes
 * effect at once), or a 401 the app shows as "please sign in again".
 */
export async function requireMobileUser(req: Request): Promise<CurrentUser> {
  const header = req.headers.get("authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  let user: CurrentUser | null = null;
  if (raw) {
    const token = await decode({ token: raw, secret: getAuthSecret() }).catch(() => null);
    if (token?.kind === "mobile" && typeof token.id === "string") {
      user = await userForSession(token.id, typeof token.sv === "number" ? token.sv : 0);
    }
  }
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  }
  return user;
}

/** For the trainer screens: a trainer login linked to a trainer profile; returns that profile's id. */
export function requireOwnTrainerProfile(user: CurrentUser, requestedTeacherId: string | null): string {
  if (user.role !== "TEACHER" || !user.teacherId) {
    throw forbiddenError("These screens are for trainer logins only.");
  }
  if (requestedTeacherId && requestedTeacherId !== user.teacherId) {
    throw forbiddenError("You can only see your own classes and students.");
  }
  return user.teacherId;
}
