import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";

const COLOR_PALETTE = [
  "#06b6d4", // Cyan
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#e11d48", // Rose
];

export const GET = withErrorHandling("GET /api/subjects", async () => {
  await requireUser();
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ success: true, subjects });
});

export const POST = withErrorHandling("POST /api/subjects", async (req) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), "Only the owner or an academic coordinator can add subjects.");

  const body = await readJsonObject(req);
  const v = new FieldCollector();
  const name = v.requiredText("name", body.name, "Subject name", 60);
  const requestedCode = v.optionalText("code", body.code, "Short code", 6);
  const category = v.optionalText("category", body.category, "Category", 40) ?? "Academic";
  const color = v.optionalText("color", body.color, "Colour", 9);
  if (requestedCode && !/^[A-Za-z0-9]+$/.test(requestedCode)) v.add("code", "Use letters and numbers only.");
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) v.add("color", "Choose a colour from the palette.");
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

  // Case-insensitive duplicate check ("chemistry" and "Chemistry" are the same subject).
  const all = await prisma.subject.findMany({ select: { id: true, name: true, code: true } });
  const existing = all.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    const subject = await prisma.subject.findUnique({ where: { id: existing.id } });
    return NextResponse.json({ success: true, subject, existing: true, message: `"${existing.name}" already exists and has been selected.` });
  }

  let baseCode = (requestedCode ?? "").toUpperCase();
  if (!baseCode) {
    const words = name.split(/\s+/).filter(Boolean);
    baseCode = (words.length >= 2 ? words.map((w) => w[0]).join("") : name).replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "SUB";
  }
  const usedCodes = new Set(all.map((s) => s.code.toUpperCase()));
  let code = baseCode;
  for (let i = 1; usedCodes.has(code); i++) code = `${baseCode.slice(0, 3)}${i}`;

  const subject = await prisma.$transaction(async (tx) => {
    const created = await tx.subject.create({
      data: { name, code, category, color: color ?? COLOR_PALETTE[all.length % COLOR_PALETTE.length] },
    });
    await tx.auditLog.create({
      data: {
        entityType: "SUBJECT",
        entityId: created.id,
        action: "CREATE_SUBJECT",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ name: created.name, code: created.code }),
      },
    });
    return created;
  });

  return NextResponse.json(
    { success: true, subject, message: `Subject "${subject.name}" (${subject.code}) added.` },
    { status: 201 }
  );
});
