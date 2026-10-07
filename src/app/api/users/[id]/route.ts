import { NextResponse } from "next/server";
import { canManageUsers, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { updateLogin } from "@/lib/services/users";

type Ctx = { params: Promise<{ id: string }> };

/** Owner edits a login (name, email, role, on/off). */
export const PATCH = withErrorHandling<Ctx>("PATCH /api/users/[id]", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canManageUsers(user.role), "Only the owner can manage logins.");
  const { id } = await params;
  const updated = await updateLogin(id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, user: updated });
});
