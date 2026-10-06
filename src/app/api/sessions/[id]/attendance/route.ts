import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { submitSessionAttendance } from "@/lib/attendance-ledger";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await req.json();

    const {
      sessionOutcome,
      studentAttendance,
      actualDurationMinutes,
      topicCovered,
      homework,
      studentProgressNote,
    } = body;

    const result = await submitSessionAttendance({
      sessionId: id,
      sessionOutcome,
      studentAttendance,
      actualDurationMinutes: Number(actualDurationMinutes) || 60,
      topicCovered: topicCovered || "General Curriculum Session",
      homework,
      studentProgressNote,
      user,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit attendance" },
      { status: 400 }
    );
  }
}
