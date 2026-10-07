import { NextResponse } from "next/server";
import { canManageTeachers, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { importTeachers } from "@/lib/services/teachers";

/**
 * Body: { dryRun: boolean, rows: [...] } — rows prepared by the import page.
 * dryRun checks every row (format, existing trainers, duplicates) without saving.
 */
export const POST = withErrorHandling("POST /api/teachers/import", async (req) => {
  const user = await requireUser();
  requirePermission(canManageTeachers(user.role), "Only the owner or an academic coordinator can import trainers.");
  const body = await readJsonObject(req);
  const result = await importTeachers(body.rows, user, { dryRun: body.dryRun !== false });
  return NextResponse.json({ success: true, ...result });
});
