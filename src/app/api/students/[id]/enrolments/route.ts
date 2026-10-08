import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import {
  notFoundError,
  readJsonObject,
  relatedRecordError,
  validationError,
  withErrorHandling,
} from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";
import { teacherPublicSelect } from "@/lib/services/students";
import { generateTimetableOccurrences, retireEnrolmentSlots } from "@/lib/services/timetable";

type Ctx = { params: Promise<{ id: string }> };

/** Enrols the student in a subject, or (re)assigns the trainer for an existing enrolment. */
export const POST = withErrorHandling<Ctx>("POST /api/students/[id]/enrolments", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canManageStudents(user.role),
    "Only the owner or an academic coordinator can manage subject enrolments."
  );

  const { id: studentId } = await params;
  const body = await readJsonObject(req);
  const v = new FieldCollector();
  const subjectId = v.id("subjectId", body.subjectId, "Subject");
  const teacherId = typeof body.teacherId === "string" && body.teacherId.trim() ? body.teacherId.trim() : null;
  const notes = v.optionalText("notes", body.notes, "Enrolment notes", 300);
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

  const [student, subject, teacher] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
    teacherId ? prisma.teacher.findUnique({ where: { id: teacherId } }) : Promise.resolve(null),
  ]);
  if (!student) throw notFoundError("This student no longer exists. Refresh the page.");
  if (!subject) throw relatedRecordError("This subject no longer exists.", { subjectId: "Choose another subject." });
  if (teacherId && (!teacher || !teacher.active)) {
    throw relatedRecordError("The selected trainer is not available.", {
      teacherId: "Choose an active trainer, or leave the subject unassigned for now.",
    });
  }

  let trainerReassigned = false;

  const enrollment = await prisma.$transaction(async (tx) => {
    const existing = await tx.subjectEnrollment.findUnique({
      where: { studentId_subjectId: { studentId, subjectId } },
    });
    const enr = existing
      ? await tx.subjectEnrollment.update({
          where: { id: existing.id },
          data: { teacherId, status: "ACTIVE", notes: notes ?? existing.notes },
          include: { subject: true, teacher: { select: teacherPublicSelect } },
        })
      : await tx.subjectEnrollment.create({
          data: { studentId, subjectId, teacherId, status: "ACTIVE", notes },
          include: { subject: true, teacher: { select: teacherPublicSelect } },
        });

    if (existing && existing.teacherId !== teacherId) {
      trainerReassigned = true;
      const now = new Date();
      const slots = await tx.timetableSlot.findMany({
        where: { enrolmentId: existing.id, active: true },
      });
      if (slots.length > 0) {
        await tx.timetableSlot.updateMany({
          where: { enrolmentId: existing.id, active: true },
          data: { teacherId, updatedByName: user.name },
        });
        await tx.session.deleteMany({
          where: {
            timetableSlotId: { in: slots.map((s) => s.id) },
            status: "SCHEDULED",
            isCreditConsumed: false,
            attendance: { is: null },
            scheduledStartTimeUtc: { gte: now },
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        entityType: "STUDENT",
        entityId: studentId,
        action: existing ? "REASSIGN_SUBJECT_TRAINER" : "ENROLL_SUBJECT",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          studentName: student.name,
          subjectName: subject.name,
          previousTeacherId: existing?.teacherId ?? null,
          teacherName: teacher?.name ?? null,
        }),
      },
    });
    return enr;
  });

  if (trainerReassigned) {
    try {
      await generateTimetableOccurrences(studentId, user);
    } catch (e) {
      console.error("Failed to re-generate timetable occurrences after trainer update", e);
    }
  }

  return NextResponse.json({
    success: true,
    enrollment,
    message: teacher
      ? `${subject.name} assigned to ${teacher.name}.`
      : `Enrolled in ${subject.name}. Trainer Not Assigned.`,
  });
});

export const DELETE = withErrorHandling<Ctx>("DELETE /api/students/[id]/enrolments", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canManageStudents(user.role),
    "Only the owner or an academic coordinator can remove subject enrolments."
  );

  const { id: studentId } = await params;
  const enrollmentId = new URL(req.url).searchParams.get("enrollmentId");
  if (!enrollmentId) throw validationError("Choose the enrolment to remove.");

  const enrollment = await prisma.subjectEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { subject: true, teacher: { select: { name: true } } },
  });
  if (!enrollment || enrollment.studentId !== studentId) {
    throw notFoundError("This enrolment no longer exists. Refresh the page.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Enrolments referenced by weekly slots are kept (inactive) so class history stays linked.
    const hasSlots = (await tx.timetableSlot.count({ where: { enrolmentId: enrollmentId } })) > 0;
    const retired = hasSlots ? await retireEnrolmentSlots(tx, enrollmentId, user) : { retired: 0, released: 0 };
    if (hasSlots) {
      await tx.subjectEnrollment.update({ where: { id: enrollmentId }, data: { status: "INACTIVE" } });
    } else {
      await tx.subjectEnrollment.delete({ where: { id: enrollmentId } });
    }
    await tx.auditLog.create({
      data: {
        entityType: "STUDENT",
        entityId: studentId,
        action: "UNENROLL_SUBJECT",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          subjectName: enrollment.subject.name,
          teacherName: enrollment.teacher?.name ?? null,
          keptAsInactive: hasSlots,
          weeklySlotsStopped: retired.retired,
          futureClassesReleased: retired.released,
        }),
      },
    });
    return retired;
  });

  return NextResponse.json({
    success: true,
    message:
      `Unenrolled from ${enrollment.subject.name}.` +
      (result.retired ? ` ${result.retired} weekly slot(s) stopped and ${result.released} future class(es) released.` : ""),
  });
});
