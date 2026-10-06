import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canScheduleSessions, requirePermission, requireUser } from "@/lib/auth";
import {
  conflictError,
  readJsonObject,
  relatedRecordError,
  validationError,
  withErrorHandling,
} from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";
import { calculatePackageBalances } from "@/lib/package-calculations";
import { describeConflict, findClash, loadBusySessions, lockPackages } from "@/lib/scheduling";
import { localDateInZone } from "@/lib/zoned-time";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

/** Schedules a one-off class and reserves one credit from the chosen package. */
export const POST = withErrorHandling("POST /api/sessions", async (req) => {
  const user = await requireUser();
  requirePermission(canScheduleSessions(user.role), "Only the owner or an academic coordinator can schedule classes.");

  const body = await readJsonObject(req);
  const v = new FieldCollector();
  const studentId = v.id("studentId", body.studentId, "Student");
  const subjectId = v.id("subjectId", body.subjectId, "Subject");
  const teacherId = v.id("teacherId", body.teacherId, "Trainer");
  const packageId = v.id("packageId", body.packageId, "Package");
  const start = v.date("scheduledStartTimeUtc", body.scheduledStartTimeUtc, "Start time", true);
  const durationMinutes = v.integer("durationMinutes", body.durationMinutes, "Duration (minutes)", { min: 15, max: 240, fallback: 60 });
  const meetingUrl = v.optionalText("meetingUrl", body.meetingUrl, "Meeting link", 500);
  if (meetingUrl && !/^https:\/\/\S+$/i.test(meetingUrl)) v.add("meetingUrl", "Use a full https:// meeting link.");
  if (v.hasErrors || !start) throw validationError("Please correct the highlighted fields.", v.errors);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const session = await prisma.$transaction(async (tx) => {
    // Lock first so two simultaneous bookings cannot both see the last credit.
    await lockPackages(tx, [packageId]);

    const [pkg, student, teacher, subject] = await Promise.all([
      tx.studentPackage.findUnique({ where: { id: packageId }, include: { allocations: true } }),
      tx.student.findUnique({ where: { id: studentId }, select: { id: true, status: true, name: true } }),
      tx.teacher.findUnique({ where: { id: teacherId }, select: { id: true, active: true, name: true } }),
      tx.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true } }),
    ]);
    if (!student) throw relatedRecordError("This student no longer exists.", { studentId: "Choose another student." });
    if (!subject) throw relatedRecordError("This subject no longer exists.", { subjectId: "Choose another subject." });
    if (!teacher || !teacher.active) {
      throw relatedRecordError("The selected trainer is not available.", { teacherId: "Choose an active trainer." });
    }
    if (!pkg || pkg.studentId !== studentId) {
      throw relatedRecordError("This package does not belong to the selected student.", { packageId: "Choose one of the student's packages." });
    }
    if (student.status !== "ACTIVE") throw conflictError(`${student.name} is ${student.status.toLowerCase()}; classes cannot be booked.`);
    if (pkg.status !== "ACTIVE") throw conflictError(`Package ${pkg.packageNumber} is ${pkg.status.toLowerCase()}. Only active packages can be booked.`);

    const classDate = localDateInZone(start, BUSINESS_TIME_ZONE);
    if (localDateInZone(pkg.startDate, BUSINESS_TIME_ZONE) > classDate) {
      throw conflictError(`Package ${pkg.packageNumber} starts on ${localDateInZone(pkg.startDate, BUSINESS_TIME_ZONE)}.`);
    }
    if (pkg.expiryDate && classDate > localDateInZone(pkg.expiryDate, BUSINESS_TIME_ZONE)) {
      throw conflictError(`Package ${pkg.packageNumber} expired on ${localDateInZone(pkg.expiryDate, BUSINESS_TIME_ZONE)}. Renew it before booking.`);
    }
    if (!pkg.allocations.some((a) => a.subjectId === subjectId)) {
      throw conflictError(`Package ${pkg.packageNumber} has no ${subject.name} classes allocated. Reallocate classes first.`);
    }
    if (durationMinutes !== pkg.durationMinutes) {
      throw validationError(`Package ${pkg.packageNumber} uses ${pkg.durationMinutes}-minute classes.`, {
        durationMinutes: `Use ${pkg.durationMinutes} minutes for this package.`,
      });
    }

    const balance = await calculatePackageBalances(packageId, tx);
    const sub = balance?.subjects.find((s) => s.subjectId === subjectId);
    if (!sub || sub.availableCredits < 1) {
      throw conflictError(
        `No unreserved ${subject.name} classes left in ${pkg.packageNumber} (remaining ${sub?.remainingCredits ?? 0}, already reserved ${sub?.reservedCredits ?? 0}).`
      );
    }

    const busy = await loadBusySessions(tx, { studentIds: [studentId], teacherIds: [teacherId], from: start, to: end });
    const clash = findClash(busy, { studentId, teacherId, start, end });
    if (clash) throw conflictError(`Scheduling conflict: ${describeConflict(clash.kind, clash.other)}`);

    const created = await tx.session.create({
      data: {
        packageId,
        studentId,
        teacherId,
        subjectId,
        scheduledStartTimeUtc: start,
        scheduledEndTimeUtc: end,
        durationMinutes,
        meetingUrl,
        status: "SCHEDULED",
        isCreditReserved: true,
        isCreditConsumed: false,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "SESSION",
        entityId: created.id,
        action: "SCHEDULE_SESSION",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ studentId, subjectId, teacherId, packageId, start: start.toISOString(), durationMinutes }),
      },
    });
    return created;
  });

  return NextResponse.json({ success: true, session }, { status: 201 });
});
