/**
 * One trainer's teaching week, read live from the weekly timetable, subject
 * allocations and booked classes (nothing is copied or stored), so every
 * change to allocations, trainers or slots shows up at once for owner,
 * coordinators and the trainer.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { notFoundError } from "../api-errors";
import { BUSINESS_TIME_ZONE } from "../constants";
import { WEEKDAYS, formatMinutes, slotInZone } from "../zoned-time";
import { TrainerSlotClash, findTrainerSlotClashes } from "./timetable";
import { TrainerWeekDay, TrainerWeekSlot, buildWeek } from "../trainer-week";

export interface TrainerScheduleStudent {
  studentId: string;
  studentName: string;
  studentCode: string;
  grade: string;
  status: string;
  subjects: { subjectName: string; subjectColor: string | null; slots: { weekday: number; startMinutes: number; endMinutes: number }[] }[];
}

export interface TrainerExtraClass {
  sessionId: string;
  start: string;
  end: string;
  studentName: string;
  subjectName: string;
}

export interface TrainerSchedule {
  trainer: { id: string; name: string; subjects: string; active: boolean; availableDays: string | null; availableTimes: string | null };
  week: TrainerWeekDay[];
  /** Flat list of the week's classes (IST), for overlap checks in the browser. */
  slots: TrainerWeekSlot[];
  students: TrainerScheduleStudent[];
  /** One-off or moved classes in the next 7 days that are not part of the weekly pattern. */
  extraClasses: TrainerExtraClass[];
  totals: { students: number; weeklyClasses: number; weeklyMinutes: number };
}

export async function getTrainerSchedule(
  teacherId: string,
  { excludeStudentId, now = new Date() }: { excludeStudentId?: string; now?: Date } = {}
): Promise<TrainerSchedule> {
  const trainer = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true, name: true, subjects: true, active: true, availableDays: true, availableTimes: true },
  });
  if (!trainer) throw notFoundError("This trainer no longer exists. Refresh the page.");

  const notThisStudent = excludeStudentId ? { studentId: { not: excludeStudentId } } : {};
  const [slotRows, enrolments, extras] = await Promise.all([
    // The same "current slot" rule as the timetable's own clash check.
    prisma.timetableSlot.findMany({
      where: { teacherId, active: true, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }], enrolment: notThisStudent },
      include: {
        enrolment: {
          include: {
            student: { select: { id: true, name: true, studentCode: true, status: true } },
            subject: { select: { name: true, color: true } },
          },
        },
      },
    }),
    prisma.subjectEnrollment.findMany({
      where: { teacherId, status: "ACTIVE", ...notThisStudent },
      include: {
        student: { select: { id: true, name: true, studentCode: true, grade: true, status: true } },
        subject: { select: { name: true, color: true } },
      },
      orderBy: { student: { name: "asc" } },
    }),
    prisma.session.findMany({
      where: {
        teacherId,
        status: "SCHEDULED",
        timetableSlotId: null,
        scheduledStartTimeUtc: { gte: now, lt: new Date(now.getTime() + 7 * 24 * 3600 * 1000) },
        ...notThisStudent,
      },
      include: { student: { select: { name: true } }, subject: { select: { name: true } } },
      orderBy: { scheduledStartTimeUtc: "asc" },
    }),
  ]);

  const slots: (TrainerWeekSlot & { enrolmentId: string })[] = slotRows.map((s) => {
    // Slots saved earlier in another zone are shown at the same moment in IST.
    const t = s.timeZone === BUSINESS_TIME_ZONE ? s : slotInZone(s, BUSINESS_TIME_ZONE, now);
    return {
      slotId: s.id,
      enrolmentId: s.enrolmentId,
      weekday: t.weekday,
      startMinutes: t.startMinutes,
      endMinutes: t.endMinutes,
      studentId: s.enrolment.student.id,
      studentName: s.enrolment.student.name,
      studentCode: s.enrolment.student.studentCode,
      studentStatus: s.enrolment.student.status,
      subjectName: s.enrolment.subject.name,
      subjectColor: s.enrolment.subject.color,
    };
  });

  const byStudent = new Map<string, TrainerScheduleStudent>();
  for (const e of enrolments) {
    const entry =
      byStudent.get(e.studentId) ??
      ({ studentId: e.student.id, studentName: e.student.name, studentCode: e.student.studentCode, grade: e.student.grade, status: e.student.status, subjects: [] } as TrainerScheduleStudent);
    entry.subjects.push({
      subjectName: e.subject.name,
      subjectColor: e.subject.color,
      slots: slots
        .filter((s) => s.enrolmentId === e.id)
        .sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.startMinutes - b.startMinutes)
        .map(({ weekday, startMinutes, endMinutes }) => ({ weekday, startMinutes, endMinutes })),
    });
    byStudent.set(e.studentId, entry);
  }

  return {
    trainer,
    week: buildWeek(slots, trainer.availableDays),
    slots: slots.map((s) => {
      const { enrolmentId, ...rest } = s;
      void enrolmentId; // internal only
      return rest;
    }),
    students: [...byStudent.values()],
    extraClasses: extras.map((x) => ({
      sessionId: x.id,
      start: x.scheduledStartTimeUtc.toISOString(),
      end: x.scheduledEndTimeUtc.toISOString(),
      studentName: x.student.name,
      subjectName: x.subject.name,
    })),
    totals: {
      students: byStudent.size,
      weeklyClasses: slots.length,
      weeklyMinutes: slots.reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0),
    },
  };
}

/**
 * Before a subject changes trainer: the first of the subject's current weekly
 * slots that would overlap a class the new trainer already teaches, with a
 * message naming both classes. Null when the change is safe (back-to-back is fine).
 */
export async function trainerChangeClash(
  db: Prisma.TransactionClient | typeof prisma,
  { enrolmentId, studentId, teacherId, now = new Date() }: { enrolmentId: string; studentId: string; teacherId: string; now?: Date }
): Promise<{ message: string; clash: TrainerSlotClash } | null> {
  const ownSlots = await db.timetableSlot.findMany({
    where: { enrolmentId, active: true, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
    include: { enrolment: { include: { student: { select: { name: true } }, subject: { select: { name: true } } } } },
  });
  if (ownSlots.length === 0) return null;
  const clashes = await findTrainerSlotClashes(db, teacherId, ownSlots, { excludeStudentId: studentId, now });
  const index = clashes.findIndex(Boolean);
  if (index < 0) return null;
  const clash = clashes[index]!;
  const mine = ownSlots[index];
  const trainer = await db.teacher.findUnique({ where: { id: teacherId }, select: { name: true } });
  const day = WEEKDAYS[mine.weekday]?.long ?? `Day ${mine.weekday}`;
  return {
    clash,
    message: `${trainer?.name ?? "This trainer"} already teaches ${clash.studentName} (${clash.subjectName}) on ${clash.label}, which overlaps ${mine.enrolment.student.name}'s ${mine.enrolment.subject.name} class on ${day} ${formatMinutes(mine.startMinutes)}–${formatMinutes(mine.endMinutes)}. Choose another trainer, or move this class in the timetable first.`,
  };
}
