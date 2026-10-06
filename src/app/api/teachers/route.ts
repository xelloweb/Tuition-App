import { NextResponse } from "next/server";
import { canManageTeachers, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { readIdempotencyKey } from "@/lib/idempotency";
import { createTeacher, listTeachersFor, parseTeacherFields } from "@/lib/services/teachers";

export const GET = withErrorHandling("GET /api/teachers", async (req) => {
  const user = await requireUser();
  const activeOnly = new URL(req.url).searchParams.get("active") !== "all";
  const teachers = await listTeachersFor(user, { activeOnly });
  return NextResponse.json({ success: true, teachers });
});

export const POST = withErrorHandling("POST /api/teachers", async (req) => {
  const user = await requireUser();
  requirePermission(
    canManageTeachers(user.role),
    "Only the owner or an academic coordinator can add trainers."
  );

  const body = await readJsonObject(req);
  const fields = parseTeacherFields(body, { partial: false, user });
  const { teacher, replayed } = await createTeacher(fields, user, readIdempotencyKey(req));

  return NextResponse.json({ success: true, teacher, replayed }, { status: replayed ? 200 : 201 });
});
