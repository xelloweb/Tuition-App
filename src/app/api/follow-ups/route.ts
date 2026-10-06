import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canLogFollowUps, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, relatedRecordError, validationError, withErrorHandling } from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";

const FOLLOW_UP_TYPES = ["DUE_PAYMENT", "OVERDUE_PAYMENT", "PACKAGE_EXHAUSTION", "PACKAGE_EXPIRY", "ACADEMIC_CHECKIN", "RENEWAL"];
const OUTCOMES = ["PROMISED_PAYMENT", "REQUESTED_CALLBACK", "DISPUTED", "RESOLVED", "UNREACHABLE"];

export const POST = withErrorHandling("POST /api/follow-ups", async (req) => {
  const user = await requireUser();
  requirePermission(canLogFollowUps(user.role), "Only the owner, coordinators or Accounts staff can log follow-ups.");

  const body = await readJsonObject(req);
  const v = new FieldCollector();
  const studentId = v.id("studentId", body.studentId, "Student");
  const type = v.oneOf("type", body.type, FOLLOW_UP_TYPES, "Follow-up type", "DUE_PAYMENT");
  const outcomeText = v.optionalText("outcome", body.outcome, "Outcome", 40);
  if (outcomeText && !OUTCOMES.includes(outcomeText)) v.add("outcome", "Choose a valid outcome.");
  const parentResponse = v.optionalText("parentResponse", body.parentResponse, "Parent response", 1000);
  const notes = v.optionalText("notes", body.notes, "Notes", 1000);
  const promisedPaymentDate = v.date("promisedPaymentDate", body.promisedPaymentDate, "Promised payment date", false);
  const nextActionDate = v.date("nextActionDate", body.nextActionDate, "Next action date", false);
  const invoiceId = typeof body.invoiceId === "string" && body.invoiceId ? body.invoiceId : null;
  const packageId = typeof body.packageId === "string" && body.packageId ? body.packageId : null;
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

  const [student, invoice, pkg] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }),
    invoiceId ? prisma.invoice.findUnique({ where: { id: invoiceId }, select: { studentId: true } }) : Promise.resolve(null),
    packageId ? prisma.studentPackage.findUnique({ where: { id: packageId }, select: { studentId: true } }) : Promise.resolve(null),
  ]);
  if (!student) throw relatedRecordError("This student no longer exists.");
  if (invoiceId && invoice?.studentId !== studentId) throw relatedRecordError("The invoice does not belong to this student.");
  if (packageId && pkg?.studentId !== studentId) throw relatedRecordError("The package does not belong to this student.");

  const followUp = await prisma.followUp.create({
    data: {
      studentId,
      invoiceId,
      packageId,
      type,
      assignedStaff: user.name,
      contactDate: new Date(),
      outcome: outcomeText,
      parentResponse,
      promisedPaymentDate,
      nextActionDate,
      notes,
      isResolved: outcomeText === "RESOLVED",
    },
  });

  return NextResponse.json({ success: true, followUp }, { status: 201 });
});
