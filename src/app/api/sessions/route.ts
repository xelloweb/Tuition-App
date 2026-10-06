import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculatePackageBalances } from "@/lib/package-calculations";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const {
      packageId,
      studentId,
      teacherId,
      subjectId,
      scheduledStartTimeUtc,
      durationMinutes = 60,
      meetingUrl,
    } = body;

    const startTime = new Date(scheduledStartTimeUtc);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    // 1. Check Package Available Credits for this subject
    const balances = await calculatePackageBalances(packageId);
    if (!balances) {
      return NextResponse.json({ error: "Package not found." }, { status: 404 });
    }

    const subBalance = balances.subjects.find((s) => s.subjectId === subjectId);
    if (!subBalance || subBalance.availableCredits < 1) {
      return NextResponse.json(
        {
          error: `Insufficient available credits for ${
            subBalance?.subjectName || "Subject"
          }. Remaining: ${subBalance?.remainingCredits || 0}, Already Reserved: ${
            subBalance?.reservedCredits || 0
          }.`,
        },
        { status: 400 }
      );
    }

    // 2. Check Teacher Overlap Conflict
    const teacherConflict = await prisma.session.findFirst({
      where: {
        teacherId,
        status: "SCHEDULED",
        scheduledStartTimeUtc: { lt: endTime },
        scheduledEndTimeUtc: { gt: startTime },
      },
      include: { student: true },
    });

    if (teacherConflict) {
      return NextResponse.json(
        {
          error: `Teacher conflict detected: Tutor already has a scheduled class with ${teacherConflict.student.name} at this time.`,
        },
        { status: 409 }
      );
    }

    // 3. Check Student Overlap Conflict
    const studentConflict = await prisma.session.findFirst({
      where: {
        studentId,
        status: "SCHEDULED",
        scheduledStartTimeUtc: { lt: endTime },
        scheduledEndTimeUtc: { gt: startTime },
      },
      include: { subject: true },
    });

    if (studentConflict) {
      return NextResponse.json(
        {
          error: `Student conflict detected: Student already has a scheduled ${studentConflict.subject.name} class at this time.`,
        },
        { status: 409 }
      );
    }

    // 4. Create Session with Credit Reserved
    const session = await prisma.session.create({
      data: {
        packageId,
        studentId,
        teacherId,
        subjectId,
        scheduledStartTimeUtc: startTime,
        scheduledEndTimeUtc: endTime,
        durationMinutes,
        meetingUrl: meetingUrl || "https://meet.google.com/xello-class",
        status: "SCHEDULED",
        isCreditReserved: true,
        isCreditConsumed: false,
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to schedule session" },
      { status: 400 }
    );
  }
}
