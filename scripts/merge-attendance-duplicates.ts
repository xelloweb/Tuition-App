/**
 * One-time data correction (owner request, 10 Oct 2026).
 *
 * Until now, "Mark Attendance" created a second class record instead of
 * completing the class already booked for that student, subject and day. The
 * booked class stayed "scheduled" (counted as Reserved) and the attendance
 * sometimes used another package, so Consumed looked wrong.
 *
 * For each such pair this moves the attendance, its credit history and the
 * trainer's pay record onto the booked class, marks that class completed, and
 * removes the extra record. Attendance, hours and pay are unchanged; nothing
 * is merged unless the booked class has no attendance of its own. Running it
 * again finds nothing. It runs during one deploy and is then removed from the build.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
/** IST calendar day [start, end) containing an instant. */
function istDay(at: Date): { gte: Date; lt: Date } {
  const local = new Date(at.getTime() + IST_OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - IST_OFFSET_MS;
  return { gte: new Date(start), lt: new Date(start + 24 * 3600 * 1000) };
}

export async function mergeAttendanceDuplicates(db: PrismaClient) {
  // Classes created by the attendance form: no booking link, completed, with attendance,
  // and a "Manual attendance" credit entry.
  const manual = await db.session.findMany({
    where: {
      timetableSlotId: null,
      status: "COMPLETED",
      attendance: { isNot: null },
    },
    include: { attendance: { select: { id: true } } },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });
  const manualIds = new Set(
    (
      await db.creditLedger.findMany({
        where: { sessionId: { in: manual.map((m) => m.id) }, eventType: "SESSION_CONSUMED", reason: { startsWith: "Manual attendance" } },
        select: { sessionId: true },
      })
    ).map((l) => l.sessionId)
  );

  const merged: { from: string; into: string; studentId: string; samePackage: boolean }[] = [];
  for (const m of manual.filter((x) => manualIds.has(x.id))) {
    const day = istDay(m.scheduledStartTimeUtc);
    const candidates = await db.session.findMany({
      where: {
        studentId: m.studentId,
        subjectId: m.subjectId,
        status: "SCHEDULED",
        isCreditConsumed: false,
        attendance: { is: null },
        scheduledStartTimeUtc: { gte: day.gte, lt: day.lt },
      },
      orderBy: { scheduledStartTimeUtc: "asc" },
    });
    const booked = candidates.find((c) => c.teacherId === m.teacherId) ?? candidates[0];
    if (!booked) continue;

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.attendanceRecord.update({ where: { sessionId: m.id }, data: { sessionId: booked.id } });
      await tx.attendanceRevision.updateMany({ where: { sessionId: m.id }, data: { sessionId: booked.id } });
      await tx.payoutItem.updateMany({ where: { sessionId: m.id }, data: { sessionId: booked.id } });
      await tx.creditLedger.updateMany({ where: { sessionId: m.id }, data: { sessionId: booked.id, packageId: booked.packageId } });
      await tx.session.update({
        where: { id: booked.id },
        data: {
          teacherId: m.teacherId,
          durationMinutes: m.durationMinutes,
          scheduledEndTimeUtc: new Date(booked.scheduledStartTimeUtc.getTime() + m.durationMinutes * 60000),
          status: "COMPLETED",
          isCreditReserved: false,
          isCreditConsumed: m.isCreditConsumed,
        },
      });
      await tx.session.delete({ where: { id: m.id } });
      await tx.auditLog.create({
        data: {
          entityType: "SESSION",
          entityId: booked.id,
          action: "MERGE_ATTENDANCE_INTO_BOOKED_CLASS",
          actorRole: "SYSTEM",
          actorName: "Consumption fix, 10 Oct 2026",
          details: JSON.stringify({ removedDuplicateSessionId: m.id, studentId: m.studentId, fromPackageId: m.packageId, toPackageId: booked.packageId }),
        },
      });
    });
    merged.push({ from: m.id, into: booked.id, studentId: m.studentId, samePackage: m.packageId === booked.packageId });
  }
  return { checked: manualIds.size, merged };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  mergeAttendanceDuplicates(prisma)
    .then((r) => console.log(`▶ Attendance merge: ${r.merged.length} of ${r.checked} form-created classes merged into their booked classes.`))
    // Never block a deploy: each merge is its own transaction; a failed one changes nothing.
    .catch((e) => console.error("Attendance merge stopped:", e instanceof Error ? e.message : e))
    .finally(() => prisma.$disconnect());
}
