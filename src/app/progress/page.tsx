import { prisma } from "@/lib/prisma";
import { getCurrentUser, isUnlinkedTrainer, UNLINKED_TRAINER_MESSAGE } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { ProgressClient } from "./ProgressClient";

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (isUnlinkedTrainer(user)) return <AccessDenied message={UNLINKED_TRAINER_MESSAGE} />;
  if (user.role === "ACCOUNTS") {
    return <AccessDenied message="Progress reports are available to the owner, coordinators and trainers." />;
  }

  const progressWhere: any = {};
  const assessmentWhere: any = {};

  if (user.role === "TEACHER" && user.teacherId) {
    progressWhere.teacherId = user.teacherId;
    assessmentWhere.teacherId = user.teacherId;
  }

  const progressList = await prisma.studentProgress.findMany({
    where: progressWhere,
    include: {
      student: true,
      subject: true,
      teacher: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const assessments = await prisma.assessment.findMany({
    where: assessmentWhere,
    include: {
      student: true,
      subject: true,
      teacher: true,
    },
    orderBy: { testDate: "desc" },
  });

  const concerns = await prisma.parentConcern.findMany({
    include: { student: true },
    orderBy: { reportedDate: "desc" },
  });

  return (
    <ProgressClient
      progressList={progressList}
      assessments={assessments}
      concerns={concerns}
    />
  );
}
