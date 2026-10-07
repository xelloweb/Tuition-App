import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";

/** Signed-in users update their own display name (shown in the header and audit trail). */
export const POST = withErrorHandling("POST /api/auth/profile", async (req) => {
  const user = await requireUser();
  const body = await readJsonObject(req);
  const v = new FieldCollector();
  const name = v.requiredText("name", body.name, "Name", 80);
  if (name && name.length < 2) v.add("name", "Name must be at least 2 characters.");
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

  const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } });
  if (before.name !== name) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { name } }),
      prisma.auditLog.create({
        data: {
          entityType: "USER",
          entityId: user.id,
          action: "UPDATE_PROFILE_NAME",
          actorRole: user.role,
          actorName: name,
          details: JSON.stringify({ from: before.name, to: name }),
        },
      }),
    ]);
  }
  return NextResponse.json({ success: true, name, message: "Your name has been updated." });
});
