import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/validation";
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

export const metadata: Metadata = {
  title: "Xello Tuition | Operations & Credit Management",
  description:
    "Internal Operations Portal for Xello Tuition: Multi-subject package allocation, credit ledger, scheduling, billing, and teacher payouts for Kerala & GCC students.",
};

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  let currentUser = null;
  if (session?.user) {
    currentUser = {
      id: (session.user as any).id,
      name: session.user.name || "Unknown",
      email: session.user.email || "",
      role: (session.user as any).role,
      teacherId: (session.user as any).teacherId || null,
    };
  }
  const tzCookie = (await cookies()).get("xello_display_tz")?.value;
  const decodedTz = tzCookie ? decodeURIComponent(tzCookie) : "";
  const displayTimeZone = decodedTz && isValidTimeZone(decodedTz) ? decodedTz : "Asia/Kolkata";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#070a12]">
        {currentUser ? (
          <AppShell currentUser={currentUser} displayTimeZone={displayTimeZone} ephemeralStorage={isEphemeralDatabase}>
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
