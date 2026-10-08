import { NextResponse } from "next/server";
import { requireUser, requirePermission, canEditPackages } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { editStudentPackage, getPackageDetailsWithHistory } from "@/lib/services/packages";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>("GET /api/packages/[id]", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(canEditPackages(user.role), "Only Admins and Academic Coordinators can view package details.");

  const { id } = await params;
  const result = await getPackageDetailsWithHistory(id);
  return NextResponse.json(result);
});

export const PATCH = withErrorHandling<Ctx>("PATCH /api/packages/[id]", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canEditPackages(user.role), "Only Admins and Academic Coordinators can edit packages.");

  const { id } = await params;
  const body = await readJsonObject(req);
  const result = await editStudentPackage(id, body as any, user);
  return NextResponse.json(result);
});
