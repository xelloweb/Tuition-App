import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, validationError, withErrorHandling } from "@/lib/api-errors";
import { validateIntake } from "@/lib/intake";
import { allowSubmission, assertSameSite, checkFormToken, clientKey, intakeOpen, readLimitedJson, todayInIst } from "@/lib/intake-server";
import { createParentSubmission, referenceForKey } from "@/lib/services/parent-submissions";

const KEY = /^[A-Za-z0-9_-]{16,100}$/;

/**
 * Public parent admission form. Creates an intake submission only and answers
 * with its reference; it never returns stored records or says whether a
 * student or phone number is already known. No login.
 */
export const POST = withErrorHandling("POST /api/public/admission-enquiries", async (req) => {
  if (!intakeOpen().open) {
    throw new ApiError(503, "SERVER_BUSY", "The admission form is not open yet. Please contact Xello Tuition directly.");
  }
  assertSameSite(req);
  const body = await readLimitedJson(req);

  // Hidden field that people never see or fill; automated scripts often do.
  if (typeof body.website === "string" && body.website.trim()) {
    throw validationError("We could not accept this form. Please refresh the page and try again.");
  }
  const token = checkFormToken(body.formToken);
  if (token === "too_fast") throw validationError("Please take a moment to check your details, then submit again.");
  if (token !== "ok") {
    throw new ApiError(409, "CONFLICT", "This form needs refreshing before it can be sent.", { details: { reason: "FORM_EXPIRED" } });
  }
  if (typeof body.submissionKey !== "string" || !KEY.test(body.submissionKey)) {
    throw validationError("The form could not be read. Refresh the page and try again.");
  }

  const subjects = await prisma.subject.findMany({ select: { id: true } });
  const { data, errors } = validateIntake(body, { subjectIds: new Set(subjects.map((s) => s.id)), todayIst: todayInIst() });
  if (!data) throw validationError("Please check the highlighted answers.", errors);

  // A retry of a form that was already saved (double click, lost connection) gets the same reference.
  const earlier = await referenceForKey(body.submissionKey);
  if (earlier) return NextResponse.json({ success: true, reference: earlier }, { status: 200, headers: { "Cache-Control": "no-store" } });

  if (!allowSubmission(clientKey(req))) {
    throw new ApiError(429, "SERVER_BUSY", "Too many forms were sent from this connection. Please wait a few minutes and try again.");
  }
  const { reference } = await createParentSubmission(data, body.submissionKey);
  return NextResponse.json({ success: true, reference }, { status: 201, headers: { "Cache-Control": "no-store" } });
});
