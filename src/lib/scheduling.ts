import { Prisma } from "@prisma/client";
import { formatInTimeZone } from "./timezones";

type Tx = Prisma.TransactionClient;

/**
 * Serialises concurrent credit-affecting writes for the given packages: the
 * first write takes the row lock (PostgreSQL) / the write lock (SQLite), so a
 * second request reads balances only after the first has committed.
 */
export async function lockPackages(tx: Tx, packageIds: string[]) {
  const ids = [...new Set(packageIds)].filter(Boolean);
  if (ids.length === 0) return;
  await tx.studentPackage.updateMany({ where: { id: { in: ids } }, data: { updatedAt: new Date() } });
}

export interface BusySession {
  id: string;
  studentId: string;
  teacherId: string;
  start: Date;
  end: Date;
  studentName: string;
  teacherName: string;
  subjectName: string;
}

/** Half-open interval overlap: 7–8 PM and 8–9 PM do not overlap (back-to-back is fine). */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function loadBusySessions(
  tx: Tx,
  { studentIds, teacherIds, from, to, excludeIds = [] }: {
    studentIds: string[];
    teacherIds: string[];
    from: Date;
    to: Date;
    excludeIds?: string[];
  }
): Promise<BusySession[]> {
  const people: Prisma.SessionWhereInput[] = [];
  if (studentIds.length) people.push({ studentId: { in: studentIds } });
  if (teacherIds.length) people.push({ teacherId: { in: teacherIds } });
  if (people.length === 0) return [];
  const rows = await tx.session.findMany({
    where: {
      status: "SCHEDULED",
      scheduledStartTimeUtc: { lt: to },
      scheduledEndTimeUtc: { gt: from },
      id: excludeIds.length ? { notIn: excludeIds } : undefined,
      OR: people,
    },
    include: {
      student: { select: { name: true } },
      teacher: { select: { name: true } },
      subject: { select: { name: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    teacherId: s.teacherId,
    start: s.scheduledStartTimeUtc,
    end: s.scheduledEndTimeUtc,
    studentName: s.student.name,
    teacherName: s.teacher.name,
    subjectName: s.subject.name,
  }));
}

export function describeConflict(
  kind: "student" | "teacher",
  other: BusySession,
  timeZone = "Asia/Kolkata"
): string {
  const when = formatInTimeZone(other.start, timeZone);
  return kind === "student"
    ? `${other.studentName} already has ${other.subjectName} with ${other.teacherName} at ${when}.`
    : `${other.teacherName} is already teaching ${other.studentName} (${other.subjectName}) at ${when}.`;
}

/** First clash for the student or the teacher in an interval, if any. */
export function findClash(
  busy: BusySession[],
  { studentId, teacherId, start, end }: { studentId: string; teacherId: string | null; start: Date; end: Date }
): { kind: "student" | "teacher"; other: BusySession } | null {
  for (const other of busy) {
    if (!overlaps(start, end, other.start, other.end)) continue;
    if (other.studentId === studentId) return { kind: "student", other };
    if (teacherId && other.teacherId === teacherId) return { kind: "teacher", other };
  }
  return null;
}
