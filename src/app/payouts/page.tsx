import { prisma } from "@/lib/prisma";
import { getCurrentUser, canApprovePayouts } from "@/lib/auth";
import { PayoutsClient } from "./PayoutsClient";

export default async function PayoutsPage() {
  const user = await getCurrentUser();

  const payoutRuns = await prisma.payoutRun.findMany({
    include: {
      items: {
        include: { teacher: true, session: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const unbatchedItems = await prisma.payoutItem.findMany({
    where: { payoutRunId: null, status: "APPROVED" },
    include: { teacher: true, session: true },
  });

  return (
    <PayoutsClient
      payoutRuns={payoutRuns}
      unbatchedItems={unbatchedItems}
      canManagePayouts={canApprovePayouts(user.role)}
    />
  );
}
