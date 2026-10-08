import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, accounts, makeSubject, makeTeacher, makeStudent, enrol, uid } from "./helpers";
import { editStudentPackage, getPackageDetailsWithHistory } from "../src/lib/services/packages";
import { calculatePackageBalances } from "../src/lib/package-calculations";
import { calculateStudentFinancialSummary } from "../src/lib/billing";
import { ApiError } from "../src/lib/api-errors";

const today = () => new Date().toISOString().slice(0, 10);
const futureDate = (days: number) => new Date(Date.now() + days * 86400 * 1000).toISOString().slice(0, 10);

async function createPackageWithSessionsAndPayments(opts: {
  totalCredits?: number;
  price?: number;
  paidAmount?: number;
  attendedClasses?: number;
} = {}) {
  const totalCredits = opts.totalCredits ?? 12;
  const price = opts.price ?? 6000;
  const paidAmount = opts.paidAmount ?? 3000;
  const attendedClasses = opts.attendedClasses ?? 4;

  const subject = await makeSubject("Physics");
  const teacher = await makeTeacher("Alan Walker");
  const student = await makeStudent();
  await enrol(student.id, subject.id, teacher.id);

  // 1. Create StudentPackage
  const pkg = await prisma.studentPackage.create({
    data: {
      packageNumber: uid("PKG"),
      studentId: student.id,
      name: "Weekly 3 (12 classes/month)",
      totalCredits,
      price,
      startDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 86400 * 1000),
      durationMinutes: 60,
      status: "ACTIVE",
      notes: "Initial package notes",
      allocations: {
        create: [{ subjectId: subject.id, allocatedCredits: totalCredits }],
      },
    },
  });

  // 2. Create linked Invoice
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: uid("INV"),
      studentId: student.id,
      packageId: pkg.id,
      subtotal: price,
      totalAmount: price,
      paidAmount,
      balanceDue: Math.max(0, price - paidAmount),
      status: paidAmount >= price ? "PAID" : paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 86400 * 1000),
    },
  });

  // 3. Create Payments
  let paymentRecord = null;
  if (paidAmount > 0) {
    paymentRecord = await prisma.payment.create({
      data: {
        paymentNumber: uid("PAY"),
        studentId: student.id,
        amount: paidAmount,
        paymentMethod: "UPI",
        isVerified: true,
        verifiedAt: new Date(),
        receivedDate: new Date(),
        allocations: {
          create: [{ invoiceId: invoice.id, amount: paidAmount }],
        },
      },
    });
  }

  // 4. Create completed sessions & attendance
  const sessions = [];
  for (let i = 0; i < attendedClasses; i++) {
    const session = await prisma.session.create({
      data: {
        studentId: student.id,
        packageId: pkg.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        scheduledStartTimeUtc: new Date(Date.now() - (i + 1) * 86400 * 1000),
        scheduledEndTimeUtc: new Date(Date.now() - (i + 1) * 86400 * 1000 + 3600 * 1000),
        durationMinutes: 60,
        status: "COMPLETED",
        isCreditConsumed: true,
        isCreditReserved: false,
        attendance: {
          create: {
            sessionOutcome: "COMPLETED",
            studentAttendance: "PRESENT",
            actualDurationMinutes: 60,
            topicCovered: `Topic ${i + 1}`,
            markedByRole: "TEACHER",
            markedByName: teacher.name,
          },
        },
      },
    });
    sessions.push(session);
  }

  return { student, subject, teacher, pkg, invoice, paymentRecord, sessions };
}

describe("Package Management - Editing & Recalculations", () => {
  test("Role-based access control: Only Admin (OWNER) and Coordinator can edit packages", async () => {
    const { pkg } = await createPackageWithSessionsAndPayments();

    const updatePayload = {
      name: "Weekly 4 (16 classes/month)",
      totalCredits: 16,
      price: 8000,
      startDate: today(),
    };

    // Owner should succeed
    const ownerResult = await editStudentPackage(pkg.id, updatePayload, owner);
    assert.equal(ownerResult.package?.totalEntitlement, 16);
    assert.equal(ownerResult.package?.price, 8000);

    // Coordinator should succeed
    const coordResult = await editStudentPackage(pkg.id, { ...updatePayload, totalCredits: 20, price: 9500 }, coordinator);
    assert.equal(coordResult.package?.totalEntitlement, 20);
    assert.equal(coordResult.package?.price, 9500);

    // Accounts role should be rejected
    await assert.rejects(
      editStudentPackage(pkg.id, { ...updatePayload, totalCredits: 24 }, accounts),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.match(err.message, /Only Admins and Academic Coordinators can edit packages/i);
        return true;
      }
    );

    // Teacher role should be rejected
    const teacherActor = { id: "t1", name: "Teacher Actor", email: "teacher@test.com", role: "TEACHER" as const };
    await assert.rejects(
      editStudentPackage(pkg.id, { ...updatePayload, totalCredits: 24 }, teacherActor),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        return true;
      }
    );
  });

  test("Package upgrade: Updates total classes, recalculates remaining classes & outstanding balance, preserving payments & attendance", async () => {
    // Initial: 12 total, 4 attended, price 6000, paid 3000 -> remaining 8, balanceDue 3000
    const { student, pkg, invoice, paymentRecord, sessions } = await createPackageWithSessionsAndPayments({
      totalCredits: 12,
      price: 6000,
      paidAmount: 3000,
      attendedClasses: 4,
    });

    const initialPaymentsCount = await prisma.payment.count({ where: { studentId: student.id } });
    const initialSessionsCount = await prisma.session.count({ where: { studentId: student.id } });
    const initialAttendanceCount = await prisma.attendanceRecord.count({ where: { session: { studentId: student.id } } });

    // Upgrade to 16 classes, ₹8,000
    const editRes = await editStudentPackage(
      pkg.id,
      {
        name: "Weekly 4 (16 classes/month)",
        totalCredits: 16,
        price: 8000,
        startDate: today(),
        expiryDate: futureDate(45),
        status: "ACTIVE",
        notes: "Upgraded by coordinator",
      },
      coordinator
    );
    const updated = editRes.package!;

    // Verify recalculations
    assert.equal(updated.totalEntitlement, 16);
    assert.equal(updated.totalConsumed, 4, "Classes attended must be strictly preserved");
    // Remaining Classes = Updated Total Classes - Classes Already Attended = 16 - 4 = 12
    assert.equal(updated.totalRemaining, 12);
    assert.equal(updated.price, 8000);
    assert.equal(updated.paidAmount, 3000, "Paid amount must not be altered");
    // Outstanding Balance = Updated Package Amount - Total Payments Received = 8000 - 3000 = 5000
    assert.equal(updated.balanceDue, 5000);

    // Verify linked invoice was updated in-place without generating a new invoice or payment
    const finalInvoices = await prisma.invoice.findMany({ where: { packageId: pkg.id } });
    assert.equal(finalInvoices.length, 1, "Must NOT create a duplicate invoice");
    assert.equal(finalInvoices[0].id, invoice.id);
    assert.equal(finalInvoices[0].totalAmount, 8000);
    assert.equal(finalInvoices[0].paidAmount, 3000);
    assert.equal(finalInvoices[0].balanceDue, 5000);
    assert.equal(finalInvoices[0].status, "PARTIALLY_PAID");

    // Verify existing payments and attendance records were preserved completely
    const finalPaymentsCount = await prisma.payment.count({ where: { studentId: student.id } });
    const finalSessionsCount = await prisma.session.count({ where: { studentId: student.id } });
    const finalAttendanceCount = await prisma.attendanceRecord.count({ where: { session: { studentId: student.id } } });

    assert.equal(finalPaymentsCount, initialPaymentsCount, "Must not create or delete payments");
    assert.equal(finalSessionsCount, initialSessionsCount, "Must not delete or alter class sessions");
    assert.equal(finalAttendanceCount, initialAttendanceCount, "Must not delete attendance records");

    // Verify finance summary reflects updated package amount & outstanding balance
    const finSummary = await calculateStudentFinancialSummary(student.id);
    assert.equal(finSummary.netBilled, 8000);
    assert.equal(finSummary.verifiedPayments, 3000);
    assert.equal(finSummary.outstanding, 5000);
  });

  test("Package downgrade with warning & confirmation when total credits < attended classes", async () => {
    // Initial: 10 total classes, 6 already attended
    const { pkg } = await createPackageWithSessionsAndPayments({
      totalCredits: 10,
      price: 5000,
      paidAmount: 5000,
      attendedClasses: 6,
    });

    // Attempting to downgrade to 5 total classes (fewer than 6 attended) without confirmation
    await assert.rejects(
      editStudentPackage(
        pkg.id,
        {
          name: "Downgraded Package",
          totalCredits: 5,
          price: 2500,
          startDate: today(),
          confirmFewerThanAttended: false,
        },
        owner
      ),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 400);
        assert.match(err.message, /Package has 6 attended classes, which is more than the requested 5 total classes/i);
        return true;
      }
    );

    // Now confirm the downgrade
    const confirmedRes = await editStudentPackage(
      pkg.id,
      {
        name: "Downgraded Package Confirmed",
        totalCredits: 5,
        price: 2500,
        startDate: today(),
        confirmFewerThanAttended: true,
      },
      owner
    );
    const confirmedResult = confirmedRes.package!;

    assert.equal(confirmedResult.totalEntitlement, 5);
    assert.equal(confirmedResult.totalConsumed, 6);
    // Remaining Classes = Updated Total Classes - Classes Already Attended = 5 - 6 = -1
    assert.equal(confirmedResult.totalRemaining, -1);
  });

  test("Audit log edit history: Records previous and updated details with timestamp and editor info", async () => {
    const { pkg } = await createPackageWithSessionsAndPayments({
      totalCredits: 12,
      price: 6000,
      paidAmount: 3000,
      attendedClasses: 3,
    });

    // Edit package as Coordinator
    await editStudentPackage(
      pkg.id,
      {
        name: "Custom 15 Classes Package",
        totalCredits: 15,
        price: 7500,
        startDate: today(),
        notes: "Coordinator updated package terms",
      },
      coordinator
    );

    // Edit again as Owner
    await editStudentPackage(
      pkg.id,
      {
        name: "Weekly 5 (20 classes/month)",
        totalCredits: 20,
        price: 10000,
        startDate: today(),
        notes: "Owner upgraded to 20 classes",
      },
      owner
    );

    // Fetch package details with history
    const details = await getPackageDetailsWithHistory(pkg.id);
    assert.ok(details);
    assert.equal(details.rawPackage.totalCredits, 20);
    assert.equal(details.rawPackage.price, 10000);
    assert.equal(details.classesAttended, 3);
    assert.equal(details.remainingClasses, 17);
    assert.equal(details.outstandingBalance, 7000); // 10000 - 3000

    // Check edit history
    assert.ok(Array.isArray(details.editHistory));
    assert.equal(details.editHistory.length, 2, "Should have 2 edit history entries");

    // Most recent edit first (Owner)
    const latest = details.editHistory[0];
    assert.equal(latest.actorName, owner.name);
    assert.equal(latest.actorRole, owner.role);
    assert.equal(latest.previous?.totalCredits, 15);
    assert.equal(latest.previous?.price, 7500);
    assert.equal(latest.updated?.totalCredits, 20);
    assert.equal(latest.updated?.price, 10000);

    // First edit (Coordinator)
    const first = details.editHistory[1];
    assert.equal(first.actorName, coordinator.name);
    assert.equal(first.actorRole, coordinator.role);
    assert.equal(first.previous?.totalCredits, 12);
    assert.equal(first.previous?.price, 6000);
    assert.equal(first.updated?.totalCredits, 15);
    assert.equal(first.updated?.price, 7500);
  });
});
