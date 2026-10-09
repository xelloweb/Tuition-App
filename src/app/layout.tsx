import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { canManageStudents, getSessionUser } from "@/lib/auth";
import { countUnreadSubmissions } from "@/lib/services/parent-submissions";
import { AuthSecretMissingError } from "@/lib/auth-options";
import { isEphemeralDatabase } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every page depends on who is signed in, so nothing is prerendered at build time
// (this also keeps `next build` independent of NEXTAUTH_SECRET).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Xello Tuition | Operations & Credit Management",
  description:
    "Internal Operations Portal for Xello Tuition: Multi-subject package allocation, credit ledger, scheduling, billing, and teacher payouts for Kerala & GCC students.",
  icons: {
    icon: "/brand/xello-mark.png",
    shortcut: "/brand/xello-mark.png",
    apple: "/brand/xello-mark.png",
  },
};


export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let currentUser = null;
  try {
    currentUser = await getSessionUser();
  } catch (err) {
    if (!(err instanceof AuthSecretMissingError) && (err as Error)?.name !== "AuthSecretMissingError") throw err;
    // Fail closed with an explanation instead of signing sessions with a guessable key.
    return (
      <html lang="en">
        <body style={{ background: "#070a12", color: "#f1f5f9", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
          <main style={{ maxWidth: 560, margin: "10vh auto", lineHeight: 1.6 }}>
            <h1 style={{ fontSize: "1.5rem" }}>Xello Tuition needs one setting</h1>
            <p>
              Sign-in is switched off because the login secret (NEXTAUTH_SECRET) is missing or not safe. The site
              owner must add it in Hostinger: Websites → xellotuition.com → Environment variables, then redeploy.
            </p>
          </main>
        </body>
      </html>
    );
  }
  // Unread parent submissions, shown next to "Admissions" for the roles that handle them.
  let navBadges: Record<string, number> = {};
  if (currentUser && canManageStudents(currentUser.role)) {
    try {
      navBadges = { "/admissions": await countUnreadSubmissions() };
    } catch {
      // The badge is a convenience; a failed count must not break every page.
    }
  }

  // The whole application uses India Standard Time; today's date is computed here, once, in IST.
  const istToday = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-canvas">
        {currentUser ? (
          <AppShell currentUser={currentUser} istToday={istToday} ephemeralStorage={isEphemeralDatabase} navBadges={navBadges}>
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
