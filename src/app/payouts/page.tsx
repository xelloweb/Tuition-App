import { prisma } from "@/lib/prisma";
import { getCurrentUser, canApprovePayouts, isUnlinkedTrainer, UNLINKED_TRAINER_MESSAGE } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PayoutsClient } from "./PayoutsClient";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const user = await getCurrentUser();
  if (isUnlinkedTrainer(user)) return <AccessDenied message={UNLINKED_TRAINER_MESSAGE} />;
  if (user.role === "COORDINATOR") {
    return <AccessDenied message="Trainer payouts are available to the owner, Accounts staff and each trainer for their own earnings." />;
  }
  const isTeacher = user.role === "TEACHER" && Boolean(user.teacherId);

  const unbatchedWhere: any = { payoutRunId: null };
  let runWhere: any = undefined;
  const itemWhere: any = {};

  if (isTeacher && user.teacherId) {
    // For a logged-in teacher: show their items
    unbatchedWhere.teacherId = user.teacherId;
    runWhere = {
      items: { some: { teacherId: user.teacherId } },
    };
    itemWhere.teacherId = user.teacherId;
  } else {
    // For admin / accounts: show approved unbatched items
    unbatchedWhere.status = "APPROVED";
  }

  const payoutRuns = await prisma.payoutRun.findMany({
    where: runWhere,
    include: {
      items: {
        where: itemWhere,
        include: {
          teacher: true,
          session: {
            include: { student: true, subject: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const unbatchedItems = await prisma.payoutItem.findMany({
    where: unbatchedWhere,
    include: {
      teacher: true,
      session: {
        include: { student: true, subject: true },
      },
    },
    orderBy: { sessionDate: "desc" },
  });

  return (
    <PayoutsClient
      payoutRuns={payoutRuns}
      unbatchedItems={unbatchedItems}
      canManagePayouts={canApprovePayouts(user.role)}
      isTeacher={isTeacher}
      teacherName={user.name}
    />
  );
}
