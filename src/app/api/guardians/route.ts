import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-errors";
import { findGuardiansByPhone } from "@/lib/services/students";

/** GET /api/guardians?phone=+971501234567 — guardians already using this WhatsApp number. */
export const GET = withErrorHandling("GET /api/guardians", async (req) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), "Only the owner or an academic coordinator can look up guardians.");

  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  const guardians = await findGuardiansByPhone(phone);
  return NextResponse.json({ success: true, guardians });
});
