import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await req.json();

    const { newScheduledStartTimeUtc, durationMinutes = 60, reason } = body;

    const oldSession = await prisma.session.findUnique({
      where: { id },
      include: { teacher: true, student: true, subject: true },
    });

    if (!oldSession) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (oldSession.isCreditConsumed) {
      return NextResponse.json(
        { error: "Cannot reschedule an already completed/consumed class." },
        { status: 400 }
      );
    }

    const newStart = new Date(newScheduledStartTimeUtc);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);

    // Conflict check on new time slot for teacher
    const teacherConflict = await prisma.session.findFirst({
      where: {
        id: { not: oldSession.id },
        teacherId: oldSession.teacherId,
        status: "SCHEDULED",
        scheduledStartTimeUtc: { lt: newEnd },
        scheduledEndTimeUtc: { gt: newStart },
      },
    });

    if (teacherConflict) {
      return NextResponse.json(
        { error: "Conflict: Teacher is unavailable at the requested replacement time." },
        { status: 409 }
      );
    }

    // Atomic Reschedule: Unreserve old session, create new session, link them
    const result = await prisma.$transaction(async (tx) => {
      const replacementSession = await tx.session.create({
        data: {
          packageId: oldSession.packageId,
          studentId: oldSession.studentId,
          teacherId: oldSession.teacherId,
          subjectId: oldSession.subjectId,
          scheduledStartTimeUtc: newStart,
          scheduledEndTimeUtc: newEnd,
          durationMinutes,
          meetingUrl: oldSession.meetingUrl,
          status: "SCHEDULED",
          rescheduledFromId: oldSession.id,
          isCreditReserved: true,
          isCreditConsumed: false,
        },
      });

      await tx.session.update({
        where: { id: oldSession.id },
        data: {
          status: "RESCHEDULED",
          rescheduledToId: replacementSession.id,
          isCreditReserved: false, // Released original reservation
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "SESSION",
          entityId: oldSession.id,
          action: "RESCHEDULE_SESSION",
          actorRole: user.role,
          actorName: user.name,
          details: JSON.stringify({
            fromSessionId: oldSession.id,
            toSessionId: replacementSession.id,
            reason,
          }),
        },
      });

      return replacementSession;
    });

    return NextResponse.json({ success: true, replacementSession: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reschedule session" },
      { status: 400 }
    );
  }
}
