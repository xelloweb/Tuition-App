import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageStudents, canManageUsers, getCurrentUser } from "@/lib/auth";
import { getSubmissionDetail, markSubmissionSeen } from "@/lib/services/parent-submissions";
import { presentDraft } from "@/lib/services/admission-drafts";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { SubmissionDetailClient } from "./SubmissionDetailClient";

export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageStudents(user.role)) {
    return <AccessDenied message="Parent submissions are handled by the owner and academic coordinators." />;
  }
  const { id } = await params;
  const detail = await getSubmissionDetail(id);
  if (!detail) notFound();
  await markSubmissionSeen(id);

  const [subjects, teachers, staff, draft] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, color: true } }),
    prisma.teacher.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, subjects: true, active: true } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["OWNER", "COORDINATOR"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    detail.draft
      ? prisma.admissionDraft.findUnique({ where: { id: detail.draft.id }, include: { parentSubmission: { select: { id: true, reference: true, submittedData: true } } } })
      : null,
  ]);

  return (
    <SubmissionDetailClient
      initialDetail={detail}
      subjects={subjects}
      teachers={teachers}
      staff={staff}
      draft={draft ? presentDraft(draft) : null}
      canDelete={canManageUsers(user.role)}
    />
  );
}
