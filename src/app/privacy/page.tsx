import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy notice | Xello Tuition",
  description: "How Xello Tuition uses the details parents share in the admission form.",
};

/** Date of the version the owner approved; change it whenever the text changes. */
const LAST_UPDATED = "10 October 2026";

/**
 * Plain-English privacy notice for the parent admission form. It describes only
 * what the app actually does; the owner approves the text before it is linked
 * (PRIVACY_NOTICE_URL). It is not legal advice.
 */
export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:pt-10">
        <p className="flex items-center gap-2 text-base font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand text-brand-ink" aria-hidden="true">
            <GraduationCap className="h-5 w-5" />
          </span>
          Xello Tuition
        </p>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Privacy notice</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated {LAST_UPDATED}</p>
        <p className="mt-4 text-base text-ink">
          This notice explains how Xello Tuition uses the details you share in our student admission form, and what you can ask
          us to do with them.
        </p>

        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>About your child: name, class or grade, board, subjects, and if you choose to tell us, school, medium of instruction and the help they need.</li>
            <li>About you: your name, your relationship to the child, WhatsApp number and country, and if you choose to tell us, another phone number, email and city.</li>
            <li>Your preferences: teaching language, start date, preferred class days and any notes you add.</li>
          </ul>
          <p>We do not ask for identity documents, payment details or passwords in this form.</p>
        </Section>

        <Section title="Why we use it">
          <ul className="list-disc space-y-1 pl-5">
            <li>To contact you about your tuition application.</li>
            <li>To plan suitable classes: subjects, a trainer and a timetable.</li>
            <li>If your child joins, to run the classes: timetable, attendance, progress notes, invoices and payments.</li>
          </ul>
          <p>We do not use these details for advertising, and we do not sell them or share them with other companies for marketing.</p>
        </Section>

        <Section title="Who can see it">
          <ul className="list-disc space-y-1 pl-5">
            <li>Xello Tuition staff who handle admissions, each with their own login.</li>
            <li>If your child joins: the trainer teaching your child can see your child&apos;s profile, including your name and WhatsApp number, and our accounts staff see what they need for fees.</li>
          </ul>
          <p>
            We contact you on WhatsApp. WhatsApp is run by Meta, so its own privacy policy applies to messages sent through it.
          </p>
        </Section>

        <Section title="How we keep it safe">
          <p>
            Your details are stored in Xello Tuition&apos;s system on our web hosting provider&apos;s server. The website uses an
            encrypted (https) connection, and only staff with their own login can see your details. The form does not use
            advertising or tracking cookies.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep your details while we are in touch with you about tuition. If your child joins, we keep them while your
            child studies with us and afterwards for as long as we need them for our records, for example fees. If your child
            does not join, you can ask us to delete your application at any time.
          </p>
        </Section>

        <Section title="Your choices">
          <p>You can ask us to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>tell you what details we hold about you and your child;</li>
            <li>correct anything that is wrong;</li>
            <li>delete your application if your child has not joined;</li>
            <li>stop using your details for the application, by withdrawing your agreement.</li>
          </ul>
          <p>To do any of these, message the Xello Tuition team on the WhatsApp number that sent you the form.</p>
        </Section>

        <Section title="Changes to this notice">
          <p>If we change this notice, we will update the date at the top of this page.</p>
        </Section>

        <p className="mt-10">
          <Link href="/admission/apply" className="inline-flex min-h-[44px] items-center text-base font-semibold text-brand-text underline">
            Back to the admission form
          </Link>
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 space-y-2 text-base text-ink">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
