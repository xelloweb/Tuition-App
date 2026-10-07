import { NextResponse } from "next/server";
import { requireUser, canManageTeachers } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (!canManageTeachers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Upsert the user record for this teacher
    const teacherUser = await prisma.user.upsert({
      where: { teacherId: id },
      update: {
        inviteToken,
        inviteExpiresAt,
      },
      create: {
        email: teacher.email,
        name: teacher.name,
        role: "TEACHER",
        teacherId: id,
        inviteToken,
        inviteExpiresAt,
      },
    });

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host");
    const inviteLink = `${protocol}://${host}/setup-password?token=${inviteToken}`;

    return NextResponse.json({ success: true, inviteLink });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
