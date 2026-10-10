import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { buildAutoPackageBackup, removeAutoPackages, reviewAutoPackages } from "@/lib/services/auto-package-cleanup";

const OWNER_ONLY = "Only the owner can remove automatically created packages.";

/** Packages created automatically from payment records (owner only). With ?backup=1: the backup file. */
export const GET = withErrorHandling("GET /api/packages/auto-created", async (req) => {
  const user = await requireUser();
  requirePermission(user.role === "OWNER", OWNER_ONLY);
  if (new URL(req.url).searchParams.get("backup") !== "1") return NextResponse.json(await reviewAutoPackages());
  const backup = await buildAutoPackageBackup(user);
  await prisma.auditLog.create({
    data: {
      entityType: "PACKAGE",
      entityId: "auto-created-packages",
      action: "DOWNLOAD_AUTO_PACKAGE_BACKUP",
      actorRole: user.role,
      actorName: user.name,
      details: JSON.stringify({ packages: backup.packages.map((p) => p.item.packageNumber) }),
    },
  });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="xello-auto-packages-backup-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

/** Removes them: body { confirm: "REMOVE" }. Payments are never changed. */
export const POST = withErrorHandling("POST /api/packages/auto-created", async (req) => {
  const user = await requireUser();
  requirePermission(user.role === "OWNER", OWNER_ONLY);
  return NextResponse.json({ success: true, ...(await removeAutoPackages(await readJsonObject(req), user)) });
});
