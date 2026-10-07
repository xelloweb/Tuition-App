import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateSafeCsv } from "@/lib/export-csv";
import { canAccessFinancial } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return new NextResponse("Your session has expired. Please sign in again.", { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "packages";

    // Exports cover every student, so trainers (scoped to their own students) cannot download them.
    if (user.role === "TEACHER") {
      return new NextResponse("Forbidden: exports are available to the owner, coordinators and Accounts.", { status: 403 });
    }
    if (type === "collections" && !canAccessFinancial(user.role)) {
      return new NextResponse(
        "Forbidden: You do not have permissions to export financial data.",
        { status: 403 }
      );
    }

    if (type === "packages") {
      const packages = await prisma.studentPackage.findMany({
        include: {
          student: true,
          allocations: { include: { subject: true } },
          sessions: true,
        },
      });

      const headers = [
        "Package Number",
        "Package Name",
        "Student Code",
        "Student Name",
        "Total Entitlement",
        "Total Consumed",
        "Total Remaining",
        "Price (INR)",
        "Status",
        "Allocations Breakdown",
      ];

      const rows = packages.map((pkg) => {
        const consumed = pkg.sessions.filter((s) => s.isCreditConsumed).length;
        const remaining = pkg.totalCredits - consumed;
        const allocStr = pkg.allocations
          .map((a) => `${a.subject.name}: ${a.allocatedCredits}`)
          .join("; ");

        return [
          pkg.packageNumber,
          pkg.name,
          pkg.student.studentCode,
          pkg.student.name,
          pkg.totalCredits,
          consumed,
          remaining,
          pkg.price,
          pkg.status,
          allocStr,
        ];
      });

      const csv = generateSafeCsv(headers, rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="xello_packages_${Date.now()}.csv"`,
        },
      });
    }

    if (type === "attendance") {
      const records = await prisma.attendanceRecord.findMany({
        include: {
          session: {
            include: {
              student: true,
              teacher: true,
              subject: true,
              package: true,
            },
          },
        },
      });

      const headers = [
        "Date",
        "Student Code",
        "Student Name",
        "Subject",
        "Teacher",
        "Session Outcome",
        "Student Attendance",
        "Actual Duration (Mins)",
        "Topic Covered",
        "Credit Consumed",
        "Reversed?",
      ];

      const rows = records.map((rec) => [
        rec.session.scheduledStartTimeUtc.toISOString().split("T")[0],
        rec.session.student.studentCode,
        rec.session.student.name,
        rec.session.subject.name,
        rec.session.teacher.name,
        rec.sessionOutcome,
        rec.studentAttendance,
        rec.actualDurationMinutes,
        rec.topicCovered,
        rec.session.isCreditConsumed ? "YES" : "NO",
        rec.isReversed ? "YES" : "NO",
      ]);

      const csv = generateSafeCsv(headers, rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="xello_attendance_${Date.now()}.csv"`,
        },
      });
    }

    if (type === "collections") {
      const invoices = await prisma.invoice.findMany({
        include: { student: true },
      });

      const headers = [
        "Invoice Number",
        "Student Code",
        "Student Name",
        "Issue Date",
        "Due Date",
        "Total Amount (INR)",
        "Paid Amount (INR)",
        "Balance Due (INR)",
        "Status",
      ];

      const rows = invoices.map((inv) => [
        inv.invoiceNumber,
        inv.student.studentCode,
        inv.student.name,
        inv.issueDate.toISOString().split("T")[0],
        inv.dueDate.toISOString().split("T")[0],
        inv.totalAmount,
        inv.paidAmount,
        inv.balanceDue,
        inv.status,
      ]);

      const csv = generateSafeCsv(headers, rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="xello_invoices_collections_${Date.now()}.csv"`,
        },
      });
    }

    return new NextResponse("Unknown report type", { status: 400 });
  } catch (err) {
    const reference = `ERR-${Date.now().toString(36).toUpperCase()}`;
    console.error(`[${reference}] GET /api/reports/export:`, err instanceof Error ? err.message.split("\n")[0] : "unknown error");
    return new NextResponse(`The export could not be generated. Please try again (reference ${reference}).`, { status: 500 });
  }
}
