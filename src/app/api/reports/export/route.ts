import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateSafeCsv } from "@/lib/export-csv";
import { canAccessFinancial } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "packages";

    if (
      (type === "collections" || type === "payouts") &&
      !canAccessFinancial(user.role)
    ) {
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
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
