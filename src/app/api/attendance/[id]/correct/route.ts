import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { correctAttendanceRecord } from "@/lib/attendance-ledger";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await req.json();

    const { newOutcome, newAttendance, reason } = body;

    const result = await correctAttendanceRecord(
      id,
      newOutcome,
      newAttendance,
      reason,
      user
    );

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to correct attendance" },
      { status: 400 }
    );
  }
}
