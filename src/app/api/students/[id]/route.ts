import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { deleteStudent, parseStudentFields, updateStudent } from "@/lib/services/students";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>("PATCH /api/students/[id]", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canManageStudents(user.role),
    "Only the owner or an academic coordinator can edit student details."
  );

  const { id } = await params;
  const body = await readJsonObject(req);
  const fields = parseStudentFields(body, { partial: true });
  const hasChanges = Object.entries(fields).some(
    ([key, value]) => value !== undefined && !(key === "newPackage" && value === null) && key !== "guardianId"
  );
  if (!hasChanges) throw validationError("Nothing to update.");

  const { student, siblingsUpdated, packageNumber } = await updateStudent(id, fields, user);
  const notes = [
    siblingsUpdated > 0 ? `Guardian details were also updated for ${siblingsUpdated} sibling(s).` : null,
    packageNumber ? `Package ${packageNumber} created.` : null,
  ].filter(Boolean);

  return NextResponse.json({
    success: true,
    student,
    message: ["Student details updated.", ...notes].join(" "),
  });
});

export const DELETE = withErrorHandling<Ctx>("DELETE /api/students/[id]", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canManageStudents(user.role),
    "Only the owner or an academic coordinator can remove students."
  );

  const { id } = await params;
  const { name, studentCode } = await deleteStudent(id, user);
  return NextResponse.json({ success: true, message: `Student "${name}" (${studentCode}) removed.` });
});
