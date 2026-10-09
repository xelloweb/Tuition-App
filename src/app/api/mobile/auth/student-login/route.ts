import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";

export const POST = withErrorHandling("POST /api/mobile/auth/student-login", async (req) => {
  const body = await readJsonObject(req);
  const studentCodeRaw = typeof body.studentCode === "string" ? body.studentCode.trim().toUpperCase() : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!studentCodeRaw) {
    throw validationError("Enter your Student ID (e.g. XST-131).");
  }

  // Allow entering "131" or "XST-131"
  const studentCode = studentCodeRaw.startsWith("XST-")
    ? studentCodeRaw
    : /^\d+$/.test(studentCodeRaw)
    ? `XST-${studentCodeRaw.padStart(3, "0")}`
    : studentCodeRaw;

  const student = await prisma.student.findUnique({
    where: { studentCode },
    include: {
      guardian: true,
      enrolments: {
        where: { status: "ACTIVE" },
        include: {
          subject: true,
          teacher: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      packages: {
        where: { status: "ACTIVE" },
        include: {
          allocations: { include: { subject: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!student || student.status !== "ACTIVE") {
    return NextResponse.json(
      { success: false, message: `Student ID "${studentCodeRaw}" not found or inactive.` },
      { status: 404 }
    );
  }

  // If phone was provided, verify last 4 digits match whatsapp number
  if (phoneRaw && phoneRaw !== "demo") {
    const studentDigits = (student.whatsappNumber || "").replace(/\D/g, "");
    const inputDigits = phoneRaw.replace(/\D/g, "");
    if (inputDigits.length >= 4 && !studentDigits.endsWith(inputDigits.slice(-4))) {
      return NextResponse.json(
        { success: false, message: "Registered WhatsApp number does not match this Student ID." },
        { status: 401 }
      );
    }
  }

  const tokenPayload = {
    studentId: student.id,
    studentCode: student.studentCode,
    type: "STUDENT",
    timestamp: Date.now(),
  };
  const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64");

  return NextResponse.json({
    success: true,
    token,
    student: {
      id: student.id,
      name: student.name,
      studentCode: student.studentCode,
      grade: student.grade,
      board: student.board,
      medium: student.medium,
      guardianName: student.guardianName,
      whatsappNumber: student.whatsappNumber,
      country: student.country,
      timeZone: student.timeZone,
      enrolledSubjects: student.enrolments.map((e) => ({
        subjectId: e.subjectId,
        subjectName: e.subject.name,
        subjectColor: e.subject.color,
        teacherName: e.teacher?.name ?? "Not assigned",
      })),
      activePackage: student.packages[0]
        ? {
            id: student.packages[0].id,
            name: student.packages[0].name,
            totalCredits: student.packages[0].totalCredits,
          }
        : null,
    },
  });
});
