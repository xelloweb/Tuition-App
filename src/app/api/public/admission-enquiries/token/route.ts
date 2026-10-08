import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-errors";
import { issueFormToken } from "@/lib/intake-server";

/** A fresh form token, so a form left open for a long time can still be sent without losing what was typed. */
export const GET = withErrorHandling("GET /api/public/admission-enquiries/token", async () =>
  NextResponse.json({ formToken: issueFormToken() }, { headers: { "Cache-Control": "no-store" } })
);
