import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { intakeOpen, issueFormToken, privacyNoticeUrl, todayInIst } from "@/lib/intake-server";
import { IntakeForm } from "@/components/intake/IntakeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Student admission form | Xello Tuition",
  description: "Share your child's details with Xello Tuition. The team will contact you to confirm the next steps.",
  robots: { index: false, follow: false },
};

/**
 * Public parent form (no login). It only shows the form: no staff pages,
 * records or navigation. Subject names are the only stored data it reads.
 */
export default async function AdmissionApplyPage() {
  const { open, preview } = intakeOpen();
  if (!open) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-10 text-ink">
        <div className="mx-auto max-w-xl rounded-card border border-line bg-surface p-6">
          <p className="flex items-center gap-2 font-bold text-ink">
            <GraduationCap className="h-5 w-5 text-brand-text" aria-hidden="true" /> Xello Tuition
          </p>
          <h1 className="mt-4 text-2xl font-bold">The admission form is not open yet</h1>
          <p className="mt-2 text-base text-ink-muted">Please contact the Xello Tuition team directly on WhatsApp.</p>
        </div>
      </main>
    );
  }
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <IntakeForm subjects={subjects} formToken={issueFormToken()} privacyUrl={privacyNoticeUrl()} preview={preview} todayIst={todayInIst()} />;
}
