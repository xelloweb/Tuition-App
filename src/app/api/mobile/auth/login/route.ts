import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { verifyCredentials } from "@/lib/auth-options";
import { issueMobileToken } from "@/lib/mobile-auth";

export const POST = withErrorHandling("POST /api/mobile/auth/login", async (req) => {
  const body = await readJsonObject(req);
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Same rules as the website login (published passwords refused, no demo password in production).
  let signedIn: Awaited<ReturnType<typeof verifyCredentials>>;
  try {
    signedIn = await verifyCredentials(email, password);
  } catch (err) {
    throw new ApiError(401, "UNAUTHENTICATED", err instanceof Error ? err.message : "Invalid email or password.");
  }

  const teacher = signedIn.teacherId
    ? await prisma.teacher.findUnique({
        where: { id: signedIn.teacherId },
        include: { enrolments: { where: { status: "ACTIVE" }, select: { id: true } } },
      })
    : null;

  const token = await issueMobileToken(signedIn);

  return NextResponse.json({
    success: true,
    token,
    user: {
      id: signedIn.id,
      name: signedIn.name,
      email: signedIn.email,
      role: signedIn.role,
      teacherId: signedIn.teacherId,
      teacher: teacher
        ? {
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            phone: teacher.phone,
            assignedStudentsCount: teacher.enrolments.length,
          }
        : null,
    },
  });
});
