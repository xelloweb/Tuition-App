import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-errors";
import { listSubmissions } from "@/lib/services/parent-submissions";

const DENIED = "Only the owner or an academic coordinator can see parent submissions.";

export const GET = withErrorHandling("GET /api/parent-submissions", async (req) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), DENIED);
  const params = new URL(req.url).searchParams;
  const result = await listSubmissions(user, {
    status: params.get("status") ?? undefined,
    assigned: params.get("assigned") ?? undefined,
    q: params.get("q") ?? undefined,
  });
  return NextResponse.json({ success: true, ...result });
});
