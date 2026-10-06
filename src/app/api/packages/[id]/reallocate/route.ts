import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validateReallocation, executeReallocation } from "@/lib/reallocation";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await req.json();
    const { allocations, reason, previewOnly, unallocatedCredits } = body;

    if (previewOnly) {
      const validation = await validateReallocation(
        id,
        allocations,
        unallocatedCredits || 0
      );
      return NextResponse.json(validation);
    }

    const result = await executeReallocation(
      id,
      allocations,
      reason,
      user,
      unallocatedCredits || 0
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reallocate package" },
      { status: 400 }
    );
  }
}
