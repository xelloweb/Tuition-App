import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";

export const POST = withErrorHandling("POST /api/mobile/auth/login", async (req) => {
  const body = await readJsonObject(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    throw validationError("Enter your email and password.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      teacher: {
        include: {
          enrolments: {
            where: { status: "ACTIVE" },
            include: {
              subject: true,
              student: { select: { id: true, name: true, studentCode: true, grade: true } },
            },
          },
        },
      },
    },
  });

  if (!user || !user.active) {
    return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
  }

  let isValid = false;
  if (user.passwordHash) {
    isValid = await bcrypt.compare(password, user.passwordHash);
  } else if (process.env.NODE_ENV !== "production" && password === "demo123") {
    isValid = true;
  }

  if (!isValid) {
    return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
  }

  // Create a simple base64-encoded bearer token with user id & role for mobile session
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    teacherId: user.teacherId,
    timestamp: Date.now(),
  };
  const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64");

  return NextResponse.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teacherId: user.teacherId,
      teacher: user.teacher
        ? {
            id: user.teacher.id,
            name: user.teacher.name,
            email: user.teacher.email,
            phone: user.teacher.phone,
            assignedStudentsCount: user.teacher.enrolments.length,
          }
        : null,
    },
  });
});
