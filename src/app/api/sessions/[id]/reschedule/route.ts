import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canScheduleSessions, requirePermission, requireUser } from "@/lib/auth";
import { conflictError, notFoundError, readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";
import { describeConflict, findClash, loadBusySessions, lockPackages } from "@/lib/scheduling";
import { localDateInZone } from "@/lib/zoned-time";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Moves a scheduled class: the original becomes RESCHEDULED (reservation
 * released) and a linked replacement is booked, atomically. Credits are
 * neither consumed nor double-reserved.
 */
export const POST = withErrorHandling<Ctx>("POST /api/sessions/[id]/reschedule", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canScheduleSessions(user.role), "Only the owner or an academic coordinator can reschedule classes.");

  const { id } = await params;
  const body = await readJsonObject(req);
  const v = new FieldCollector();
  const newStart = v.date("newScheduledStartTimeUtc", body.newScheduledStartTimeUtc, "New start time", true);
  const reason = v.optionalText("reason", body.reason, "Reason", 300);
  if (v.hasErrors || !newStart) throw validationError("Please correct the highlighted fields.", v.errors);

  const result = await prisma.$transaction(async (tx) => {
    const old = await tx.session.findUnique({ where: { id }, include: { package: true, attendance: { select: { id: true } } } });
    if (!old) throw notFoundError("This class no longer exists. Refresh the page.");
    await lockPackages(tx, [old.packageId]);

    if (old.status !== "SCHEDULED" || old.isCreditConsumed || old.attendance) {
      throw conflictError("Only scheduled classes without attendance can be rescheduled.");
    }
    const durationMinutes = v.integer("durationMinutes", body.durationMinutes, "Duration", { min: 15, max: 240, fallback: old.durationMinutes });
    if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60000);

    const pkg = old.package;
    const classDate = localDateInZone(newStart, BUSINESS_TIME_ZONE);
    if (pkg.status !== "ACTIVE") throw conflictError(`Package ${pkg.packageNumber} is ${pkg.status.toLowerCase()}.`);
    if (pkg.expiryDate && classDate > localDateInZone(pkg.expiryDate, BUSINESS_TIME_ZONE)) {
      throw conflictError(`Package ${pkg.packageNumber} expires on ${localDateInZone(pkg.expiryDate, BUSINESS_TIME_ZONE)}; choose an earlier date or renew.`);
    }

    const busy = await loadBusySessions(tx, {
      studentIds: [old.studentId],
      teacherIds: [old.teacherId],
      from: newStart,
      to: newEnd,
      excludeIds: [old.id],
    });
    const clash = findClash(busy, { studentId: old.studentId, teacherId: old.teacherId, start: newStart, end: newEnd });
    if (clash) throw conflictError(`Scheduling conflict: ${describeConflict(clash.kind, clash.other)}`);

    // Conditional update guards against a concurrent reschedule of the same class.
    const released = await tx.session.updateMany({
      where: { id: old.id, status: "SCHEDULED", isCreditConsumed: false },
      data: { status: "RESCHEDULED", isCreditReserved: false },
    });
    if (released.count !== 1) throw conflictError("This class was changed by someone else. Refresh and try again.");

    const replacement = await tx.session.create({
      data: {
        packageId: old.packageId,
        studentId: old.studentId,
        teacherId: old.teacherId,
        subjectId: old.subjectId,
        scheduledStartTimeUtc: newStart,
        scheduledEndTimeUtc: newEnd,
        durationMinutes,
        meetingUrl: old.meetingUrl,
        status: "SCHEDULED",
        rescheduledFromId: old.id,
        isCreditReserved: true,
        isCreditConsumed: false,
      },
    });
    await tx.session.update({ where: { id: old.id }, data: { rescheduledToId: replacement.id } });
    await tx.auditLog.create({
      data: {
        entityType: "SESSION",
        entityId: old.id,
        action: "RESCHEDULE_SESSION",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          fromSessionId: old.id,
          toSessionId: replacement.id,
          from: old.scheduledStartTimeUtc.toISOString(),
          to: newStart.toISOString(),
          reason,
        }),
      },
    });
    return replacement;
  });

  return NextResponse.json({ success: true, replacementSession: result });
});
