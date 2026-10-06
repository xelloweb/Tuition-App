import { NextResponse } from "next/server";
import { canReallocatePackages, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { executeReallocation, parseAllocations, validateReallocation } from "@/lib/reallocation";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>("POST /api/packages/[id]/reallocate", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canReallocatePackages(user.role),
    "Only the owner or an academic coordinator can reallocate package classes."
  );

  const { id } = await params;
  const body = await readJsonObject(req);
  const { allocations, unallocated } = parseAllocations(body.allocations, body.unallocatedCredits);

  if (body.previewOnly === true) {
    return NextResponse.json(await validateReallocation(id, allocations, unallocated));
  }

  const result = await executeReallocation(id, allocations, typeof body.reason === "string" ? body.reason : "", user, unallocated);
  return NextResponse.json(result);
});
