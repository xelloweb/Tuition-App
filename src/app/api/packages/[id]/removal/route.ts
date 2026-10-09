import { NextResponse } from "next/server";
import { requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { previewPackageRemoval, removePackage } from "@/lib/services/package-removal";

type Ctx = { params: Promise<{ id: string }> };

/** What removing a wrongly created package would remove and keep (owner only). */
export const GET = withErrorHandling<Ctx>("GET /api/packages/[id]/removal", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(user.role === "OWNER", "Only the owner can remove a package.");
  const { id } = await params;
  return NextResponse.json(await previewPackageRemoval(id));
});

/** Removes it: body { confirmPackageNumber, moveAttendedTo? }. Payments are never touched. */
export const POST = withErrorHandling<Ctx>("POST /api/packages/[id]/removal", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(user.role === "OWNER", "Only the owner can remove a package.");
  const { id } = await params;
  const result = await removePackage(id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, ...result });
});
