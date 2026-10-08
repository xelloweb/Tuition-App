import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { canManageStudents, getCurrentUser } from "@/lib/auth";
import { listSubmissions } from "@/lib/services/parent-submissions";
import { privacyNoticeUrl } from "@/lib/intake-server";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { AdmissionsClient } from "./AdmissionsClient";

export const dynamic = "force-dynamic";

/** The shareable link uses the configured site address (NEXTAUTH_URL), never a guessed one. */
async function formLink() {
  const configured = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (configured) return { url: `${configured}/admission/apply`, fromSetting: true };
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return { url: host ? `${proto}://${host}/admission/apply` : "/admission/apply", fromSetting: false };
}

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function AdmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canManageStudents(user.role)) {
    return <AccessDenied message="Admissions and parent submissions are handled by the owner and academic coordinators." />;
  }
  const sp = await searchParams;
  const filter = { status: one(sp.status) ?? "OPEN", assigned: one(sp.assigned) ?? "ANY", q: one(sp.q) ?? "" };
  const [list, grouped, link] = await Promise.all([
    listSubmissions(user, filter),
    prisma.parentSubmission.groupBy({ by: ["status"], _count: { _all: true } }),
    formLink(),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  return (
    <AdmissionsClient
      link={link}
      privacyConfigured={Boolean(privacyNoticeUrl())}
      items={list.items}
      total={list.total}
      filter={filter}
      counts={counts}
    />
  );
}
