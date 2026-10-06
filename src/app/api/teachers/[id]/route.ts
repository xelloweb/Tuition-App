import { NextResponse } from "next/server";
import { canManageTeachers, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { deleteTeacher, parseTeacherFields, updateTeacher } from "@/lib/services/teachers";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>("PATCH /api/teachers/[id]", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canManageTeachers(user.role),
    "Only the owner or an academic coordinator can edit trainer profiles."
  );

  const { id } = await params;
  const body = await readJsonObject(req);
  const fields = parseTeacherFields(body, { partial: true, user });
  if (Object.keys(fields).length === 0) throw validationError("Nothing to update.");

  const { teacher, warning } = await updateTeacher(id, fields, user);
  return NextResponse.json({
    success: true,
    teacher,
    warning,
    message: "Trainer profile updated.",
  });
});

export const DELETE = withErrorHandling<Ctx>("DELETE /api/teachers/[id]", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canManageTeachers(user.role),
    "Only the owner or an academic coordinator can remove trainers."
  );

  const { id } = await params;
  const { name } = await deleteTeacher(id, user);
  return NextResponse.json({ success: true, message: `Trainer "${name}" removed.` });
});
