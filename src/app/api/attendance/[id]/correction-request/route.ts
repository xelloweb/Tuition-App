import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { createCorrectionRequest } from "@/lib/services/correction-requests";

type Ctx = { params: Promise<{ id: string }> };

/** The trainer who taught the class asks staff to correct submitted attendance (id = attendance record). */
export const POST = withErrorHandling<Ctx>("POST /api/attendance/[id]/correction-request", async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const request = await createCorrectionRequest(id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, request, message: "Request sent. Staff will review it; you will see the outcome here." }, { status: 201 });
});
