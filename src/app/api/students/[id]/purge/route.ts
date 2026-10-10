import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { buildStudentBackup, previewStudentPurge, purgeStudent } from "@/lib/services/student-purge";

type Ctx = { params: Promise<{ id: string }> };
const OWNER_ONLY = "Only the owner can permanently delete a student.";

/**
 * What a permanent delete would remove (owner only). With ?backup=1: the
 * backup file of every one of those records, downloaded before deleting.
 */
export const GET = withErrorHandling<Ctx>("GET /api/students/[id]/purge", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(user.role === "OWNER", OWNER_ONLY);
  const { id } = await params;
  if (new URL(req.url).searchParams.get("backup") !== "1") {
    return NextResponse.json(await previewStudentPurge(id));
  }
  const backup = await buildStudentBackup(id, user);
  await prisma.auditLog.create({
    data: {
      entityType: "STUDENT",
      entityId: id,
      action: "DOWNLOAD_STUDENT_BACKUP",
      actorRole: user.role,
      actorName: user.name,
      details: JSON.stringify({ studentCode: backup.student.studentCode }),
    },
  });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="xello-backup-${backup.student.studentCode}-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

/** Deletes permanently: body { confirmStudentCode }. */
export const POST = withErrorHandling<Ctx>("POST /api/students/[id]/purge", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(user.role === "OWNER", OWNER_ONLY);
  const { id } = await params;
  const result = await purgeStudent(id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, ...result });
});
