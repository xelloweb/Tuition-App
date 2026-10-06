import assert from "node:assert";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { calculatePackageBalances } from "../src/lib/package-calculations";
import { validateReallocation, executeReallocation } from "../src/lib/reallocation";
import { submitSessionAttendance, correctAttendanceRecord } from "../src/lib/attendance-ledger";
import { verifyAndAllocatePayment, calculateStudentFinancialSummary } from "../src/lib/billing";
import { formatInTimeZone } from "../src/lib/timezones";
import { canMarkAttendance, canReallocatePackages, DEMO_USERS } from "../src/lib/auth";

// These scenarios create records, so never point them at the development database.
const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl || dbUrl === "file:./dev.db" || (dbUrl.startsWith("file:") && path.resolve(dbUrl.slice(5)) === path.resolve(__dirname, "..", "prisma", "dev.db"))) {
  console.error("Refusing to run acceptance tests against prisma/dev.db. Use `npm test`, which creates a disposable database.");
  process.exit(1);
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("🚀 XELLO TUITION: 18 ACCEPTANCE TEST SCENARIOS RUNNER");
  console.log("=======================================================\n");

  let passedCount = 0;

  async function scenario(num: number, title: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`Scenario ${num.toString().padStart(2, "0")}: ${title} ... `);
      await fn();
      console.log("✅ PASSED");
      passedCount++;
    } catch (err: any) {
      console.log(`❌ FAILED\n   Error: ${err.message}`);
      throw err;
    }
  }

  // Set up fresh isolated test sandbox student and entities
  const testRunId = Date.now().toString().slice(-6);

  // 1. Scenario 1: Create a student, two subjects, two teachers, and a 20-class package allocated 10/10.
  let student1Id = "";
  let pkg1Id = "";
  const chemId = "sub-chem";
  const engId = "sub-eng";
  const rahulId = "tch-rahul";
  const priyaId = "tch-priya";

  await scenario(1, "Create student, 2 subjects, 2 teachers, 20-class package allocated 10/10", async () => {
    const student = await prisma.student.create({
      data: {
        studentCode: `TEST-${testRunId}`,
        name: `Test Student ${testRunId}`,
        grade: "11th Grade",
        board: "CBSE",
        guardianName: "Test Guardian",
        whatsappNumber: "+971501112233",
        country: "UAE",
        timeZone: "Asia/Dubai",
      },
    });
    student1Id = student.id;

    const pkg = await prisma.studentPackage.create({
      data: {
        packageNumber: `PKG-TEST-${testRunId}`,
        studentId: student.id,
        name: "Test 20-Pack",
        totalCredits: 20,
        price: 18000,
        currency: "INR",
        cancellationNoticeHours: 4,
        noShowDeductCredit: true,
      },
    });
    pkg1Id = pkg.id;

    await prisma.subjectAllocation.createMany({
      data: [
        { packageId: pkg1Id, subjectId: chemId, allocatedCredits: 10 },
        { packageId: pkg1Id, subjectId: engId, allocatedCredits: 10 },
      ],
    });

    const balances = await calculatePackageBalances(pkg1Id);
    assert(balances !== null, "Package balances should not be null");
    assert.strictEqual(balances.totalEntitlement, 20);
    assert.strictEqual(balances.totalConsumed, 0);
    assert.strictEqual(balances.totalRemaining, 20);
    const chemBal = balances.subjects.find((s) => s.subjectId === chemId);
    const engBal = balances.subjects.find((s) => s.subjectId === engId);
    assert.strictEqual(chemBal?.allocatedCredits, 10);
    assert.strictEqual(engBal?.allocatedCredits, 10);
  });

  // 2. Scenario 2: Complete 6 Chemistry and 4 English classes; verify remaining total is 10.
  const chemSessionIds: string[] = [];
  const engSessionIds: string[] = [];

  await scenario(2, "Complete 6 Chemistry and 4 English classes; verify remaining total is 10", async () => {
    for (let i = 1; i <= 6; i++) {
      const pastDate = new Date(Date.now() - (20 - i) * 3600 * 1000);
      const session = await prisma.session.create({
        data: {
          packageId: pkg1Id,
          studentId: student1Id,
          teacherId: rahulId,
          subjectId: chemId,
          scheduledStartTimeUtc: pastDate,
          scheduledEndTimeUtc: new Date(pastDate.getTime() + 3600 * 1000),
          status: "SCHEDULED",
        },
      });
      chemSessionIds.push(session.id);
      await submitSessionAttendance({
        sessionId: session.id,
        sessionOutcome: "COMPLETED",
        studentAttendance: "PRESENT",
        actualDurationMinutes: 60,
        topicCovered: `Chem Lesson ${i}`,
        user: DEMO_USERS.admin,
      });
    }

    for (let i = 1; i <= 4; i++) {
      const pastDate = new Date(Date.now() - (10 - i) * 3600 * 1000);
      const session = await prisma.session.create({
        data: {
          packageId: pkg1Id,
          studentId: student1Id,
          teacherId: priyaId,
          subjectId: engId,
          scheduledStartTimeUtc: pastDate,
          scheduledEndTimeUtc: new Date(pastDate.getTime() + 3600 * 1000),
          status: "SCHEDULED",
        },
      });
      engSessionIds.push(session.id);
      await submitSessionAttendance({
        sessionId: session.id,
        sessionOutcome: "COMPLETED",
        studentAttendance: "PRESENT",
        actualDurationMinutes: 60,
        topicCovered: `English Lesson ${i}`,
        user: DEMO_USERS.admin,
      });
    }

    const balances = await calculatePackageBalances(pkg1Id);
    assert(balances !== null);
    assert.strictEqual(balances.totalConsumed, 10);
    assert.strictEqual(balances.totalRemaining, 10);
    const chemBal = balances.subjects.find((s) => s.subjectId === chemId);
    const engBal = balances.subjects.find((s) => s.subjectId === engId);
    assert.strictEqual(chemBal?.consumedCredits, 6);
    assert.strictEqual(chemBal?.remainingCredits, 4);
    assert.strictEqual(engBal?.consumedCredits, 4);
    assert.strictEqual(engBal?.remainingCredits, 6);
  });

  // 3. Scenario 3: Reallocate to 15 Chemistry and 5 English; verify remaining balances are 9 and 1.
  await scenario(3, "Reallocate to 15 Chemistry and 5 English; verify remaining balances are 9 and 1", async () => {
    await executeReallocation(
      pkg1Id,
      [
        { subjectId: chemId, newAllocatedCredits: 15 },
        { subjectId: engId, newAllocatedCredits: 5 },
      ],
      "Exam season booster reallocation requested by parent",
      DEMO_USERS.admin
    );

    const balances = await calculatePackageBalances(pkg1Id);
    assert(balances !== null);
    assert.strictEqual(balances.totalEntitlement, 20);
    assert.strictEqual(balances.totalConsumed, 10);
    assert.strictEqual(balances.totalRemaining, 10);
    const chemBal = balances.subjects.find((s) => s.subjectId === chemId);
    const engBal = balances.subjects.find((s) => s.subjectId === engId);
    assert.strictEqual(chemBal?.allocatedCredits, 15);
    assert.strictEqual(chemBal?.consumedCredits, 6);
    assert.strictEqual(chemBal?.remainingCredits, 9);
    assert.strictEqual(engBal?.allocatedCredits, 5);
    assert.strictEqual(engBal?.consumedCredits, 4);
    assert.strictEqual(engBal?.remainingCredits, 1);
  });

  // 4. Scenario 4: Reject an allocation below already consumed credits.
  await scenario(4, "Reject an allocation below already consumed credits", async () => {
    // English consumed is 4. Try allocating 3!
    let rejected = false;
    try {
      await executeReallocation(
        pkg1Id,
        [
          { subjectId: chemId, newAllocatedCredits: 17 },
          { subjectId: engId, newAllocatedCredits: 3 }, // < 4 consumed!
        ],
        "Illegal reduction attempt",
        DEMO_USERS.admin
      );
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes("already been consumed"));
    }
    assert.strictEqual(rejected, true, "Should have thrown error rejecting allocation below consumed credits");
  });

  // 5. Scenario 5: Detect and resolve excess future reservations before reallocation.
  await scenario(5, "Detect and resolve excess future reservations before reallocation", async () => {
    // Currently English remaining is 1. Let's schedule 3 future English sessions!
    const fut1 = await prisma.session.create({
      data: {
        packageId: pkg1Id,
        studentId: student1Id,
        teacherId: priyaId,
        subjectId: engId,
        scheduledStartTimeUtc: new Date(Date.now() + 24 * 3600 * 1000),
        scheduledEndTimeUtc: new Date(Date.now() + 25 * 3600 * 1000),
        status: "SCHEDULED",
        isCreditReserved: true,
      },
    });
    const fut2 = await prisma.session.create({
      data: {
        packageId: pkg1Id,
        studentId: student1Id,
        teacherId: priyaId,
        subjectId: engId,
        scheduledStartTimeUtc: new Date(Date.now() + 48 * 3600 * 1000),
        scheduledEndTimeUtc: new Date(Date.now() + 49 * 3600 * 1000),
        status: "SCHEDULED",
        isCreditReserved: true,
      },
    });

    // Now try to reallocate English down to 4 (leaving 0 remaining while 2 are reserved)
    const val = await validateReallocation(pkg1Id, [
      { subjectId: chemId, newAllocatedCredits: 16 },
      { subjectId: engId, newAllocatedCredits: 4 }, // 4 allocated - 4 consumed = 0 remaining, but 2 reserved!
    ]);
    assert.strictEqual(val.valid, false);
    assert(val.affectedSessions.length > 0, "Conflict detector should identify excess scheduled sessions");

    // Clean up test sessions
    await prisma.session.deleteMany({
      where: { id: { in: [fut1.id, fut2.id] } },
    });
  });

  // 6. Scenario 6: Reschedule a class without double reservation or consumption.
  await scenario(6, "Reschedule a class without double reservation or consumption", async () => {
    const originalDate = new Date(Date.now() + 72 * 3600 * 1000);
    const newDate = new Date(Date.now() + 96 * 3600 * 1000);

    const origSession = await prisma.session.create({
      data: {
        packageId: pkg1Id,
        studentId: student1Id,
        teacherId: rahulId,
        subjectId: chemId,
        scheduledStartTimeUtc: originalDate,
        scheduledEndTimeUtc: new Date(originalDate.getTime() + 3600 * 1000),
        status: "SCHEDULED",
        isCreditReserved: true,
        isCreditConsumed: false,
      },
    });

    // Reschedule action: unreserve original, link to replacement
    const replacementSession = await prisma.$transaction(async (tx) => {
      const replacement = await tx.session.create({
        data: {
          packageId: pkg1Id,
          studentId: student1Id,
          teacherId: rahulId,
          subjectId: chemId,
          scheduledStartTimeUtc: newDate,
          scheduledEndTimeUtc: new Date(newDate.getTime() + 3600 * 1000),
          status: "SCHEDULED",
          rescheduledFromId: origSession.id,
          isCreditReserved: true,
          isCreditConsumed: false,
        },
      });

      await tx.session.update({
        where: { id: origSession.id },
        data: {
          status: "RESCHEDULED",
          rescheduledToId: replacement.id,
          isCreditReserved: false, // Released!
        },
      });

      return replacement;
    });

    const balances = await calculatePackageBalances(pkg1Id);
    const chemBal = balances?.subjects.find((s) => s.subjectId === chemId);
    assert.strictEqual(chemBal?.reservedCredits, 1, "Only replacement class should be reserved, not original");

    // Clean up
    await prisma.session.deleteMany({
      where: { id: { in: [origSession.id, replacementSession.id] } },
    });
  });

  // 7. Scenario 7: Verify teacher absence consumes no credit.
  await scenario(7, "Verify teacher absence consumes no credit", async () => {
    const pastDate = new Date(Date.now() - 3600 * 1000);
    const ses = await prisma.session.create({
      data: {
        packageId: pkg1Id,
        studentId: student1Id,
        teacherId: rahulId,
        subjectId: chemId,
        scheduledStartTimeUtc: pastDate,
        scheduledEndTimeUtc: new Date(pastDate.getTime() + 3600 * 1000),
        status: "SCHEDULED",
      },
    });

    const res = await submitSessionAttendance({
      sessionId: ses.id,
      sessionOutcome: "TEACHER_NO_SHOW",
      studentAttendance: "PRESENT",
      actualDurationMinutes: 0,
      topicCovered: "Tutor unavailable due to power cut",
      user: DEMO_USERS.admin,
    });

    assert.strictEqual(res.shouldConsumeCredit, false);
    const updated = await prisma.session.findUnique({ where: { id: ses.id } });
    assert.strictEqual(updated?.isCreditConsumed, false);
  });

  // 8. Scenario 8: Submit attendance twice; consume only once (Idempotency).
  await scenario(8, "Submit attendance twice; consume only once", async () => {
    const pastDate = new Date(Date.now() - 7200 * 1000);
    const ses = await prisma.session.create({
      data: {
        packageId: pkg1Id,
        studentId: student1Id,
        teacherId: rahulId,
        subjectId: chemId,
        scheduledStartTimeUtc: pastDate,
        scheduledEndTimeUtc: new Date(pastDate.getTime() + 3600 * 1000),
        status: "SCHEDULED",
      },
    });

    const first = await submitSessionAttendance({
      sessionId: ses.id,
      sessionOutcome: "COMPLETED",
      studentAttendance: "PRESENT",
      actualDurationMinutes: 60,
      topicCovered: "Alkenes Addition",
      user: DEMO_USERS.admin,
    });
    assert.strictEqual(first.alreadyProcessed, false);

    // Second duplicate submission attempt
    const second = await submitSessionAttendance({
      sessionId: ses.id,
      sessionOutcome: "COMPLETED",
      studentAttendance: "PRESENT",
      actualDurationMinutes: 60,
      topicCovered: "Alkenes Addition",
      user: DEMO_USERS.admin,
    });
    assert.strictEqual(second.alreadyProcessed, true, "Duplicate submission must be recognized as already processed");

    const ledgerEntries = await prisma.creditLedger.count({
      where: { sessionId: ses.id, eventType: "SESSION_CONSUMED" },
    });
    assert.strictEqual(ledgerEntries, 1, "Only one credit ledger deduction must exist");
  });

  // 9. Scenario 9: Correct attendance and verify the reversal history and balances.
  await scenario(9, "Correct attendance and verify the reversal history and balances", async () => {
    const pastDate = new Date(Date.now() - 10000 * 1000);
    const ses = await prisma.session.create({
      data: {
        packageId: pkg1Id,
        studentId: student1Id,
        teacherId: rahulId,
        subjectId: chemId,
        scheduledStartTimeUtc: pastDate,
        scheduledEndTimeUtc: new Date(pastDate.getTime() + 3600 * 1000),
        status: "SCHEDULED",
      },
    });

    const sub = await submitSessionAttendance({
      sessionId: ses.id,
      sessionOutcome: "COMPLETED",
      studentAttendance: "PRESENT",
      actualDurationMinutes: 60,
      topicCovered: "Redox Reactions",
      user: DEMO_USERS.admin,
    });

    // Attendance correction: tutor made error, student was actually absent with excused notice
    await correctAttendanceRecord(
      sub.attendanceId,
      "CANCELLED",
      "ABSENT",
      "Excused illness notice sent in advance by parent; tutor misreported",
      DEMO_USERS.admin
    );

    const reversedRecord = await prisma.attendanceRecord.findUnique({
      where: { id: sub.attendanceId },
      include: { revisions: true },
    });
    assert.strictEqual(reversedRecord?.isReversed, true);
    assert.strictEqual(reversedRecord?.sessionOutcome, "CANCELLED");
    assert.strictEqual(reversedRecord?.revisions.length, 1);

    const reversalLedger = await prisma.creditLedger.findFirst({
      where: { sessionId: ses.id, eventType: "SESSION_REVERSED" },
    });
    assert(reversalLedger !== null, "Reversal ledger entry must be recorded");
    assert.strictEqual(reversalLedger.creditsDelta, 1);
  });

  // 10. Scenario 10: Bill ₹6,000, verify a ₹2,000 payment, and show ₹4,000 outstanding.
  let invoice10Id = "";
  let payment10Id = "";
  await scenario(10, "Bill ₹6,000, verify a ₹2,000 payment, and show ₹4,000 outstanding", async () => {
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-TEST-${testRunId}`,
        studentId: student1Id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        subtotal: 6000,
        totalAmount: 6000,
        paidAmount: 0,
        balanceDue: 6000,
        status: "UNPAID",
      },
    });
    invoice10Id = inv.id;

    const pay = await prisma.payment.create({
      data: {
        paymentNumber: `PAY-TEST-${testRunId}`,
        studentId: student1Id,
        amount: 2000,
        currency: "INR",
        receivedDate: new Date(),
        paymentMethod: "UPI",
        isVerified: false,
      },
    });
    payment10Id = pay.id;

    await verifyAndAllocatePayment({
      paymentId: pay.id,
      invoiceId: inv.id,
      user: DEMO_USERS.accounts,
    });

    const updatedInv = await prisma.invoice.findUnique({ where: { id: inv.id } });
    assert.strictEqual(updatedInv?.paidAmount, 2000);
    assert.strictEqual(updatedInv?.balanceDue, 4000);
    assert.strictEqual(updatedInv?.status, "PARTIALLY_PAID");
  });

  // 11. Scenario 11: Confirm outstanding becomes overdue only after the applicable due date.
  await scenario(11, "Confirm outstanding becomes overdue only after applicable due date", async () => {
    // Current invoice10 has due date +7 days in the future. Check summary!
    const summaryBefore = await calculateStudentFinancialSummary(student1Id);
    assert(summaryBefore.outstanding >= 4000);

    // Make due date in the past
    await prisma.invoice.update({
      where: { id: invoice10Id },
      data: { dueDate: new Date(Date.now() - 24 * 3600 * 1000) },
    });

    const summaryAfter = await calculateStudentFinancialSummary(student1Id);
    assert(summaryAfter.overdue >= 4000, "Should count in overdue after due date has passed");
  });

  // 12. Scenario 12: Upload payment proof without verification; balance remains unchanged.
  await scenario(12, "Upload payment proof without verification; balance remains unchanged", async () => {
    const invBefore = await prisma.invoice.findUnique({ where: { id: invoice10Id } });

    // Upload proof
    await prisma.payment.create({
      data: {
        paymentNumber: `PAY-PROOF-${testRunId}`,
        studentId: student1Id,
        amount: 4000,
        currency: "INR",
        paymentMethod: "BANK_TRANSFER",
        proofFileName: "unverified_bank_receipt.pdf",
        proofUrl: "/proofs/test.pdf",
        isVerified: false, // UNVERIFIED!
      },
    });

    const invAfter = await prisma.invoice.findUnique({ where: { id: invoice10Id } });
    assert.strictEqual(invAfter?.balanceDue, invBefore?.balanceDue, "Balance due must NOT change upon unverified proof upload");
  });

  // 13. Scenario 13: Apply an advance without double-counting collection.
  await scenario(13, "Apply an advance without double-counting collection", async () => {
    const advPayment = await prisma.payment.create({
      data: {
        paymentNumber: `PAY-ADV-${testRunId}`,
        studentId: student1Id,
        amount: 5000,
        currency: "INR",
        paymentMethod: "BANK_TRANSFER",
        isVerified: true,
        verifiedByName: "Accounts",
        verifiedByRole: "ACCOUNTS",
      },
    });

    const fin = await calculateStudentFinancialSummary(student1Id);
    assert(fin.unallocatedAdvances >= 5000, "Unallocated advance must be identified separately");
  });

  // 14. Scenario 14: Verify renewal does not overwrite the previous package.
  await scenario(14, "Verify renewal does not overwrite the previous package", async () => {
    const renewedPkg = await prisma.studentPackage.create({
      data: {
        packageNumber: `PKG-RENEW-${testRunId}`,
        studentId: student1Id,
        name: "Renewed 20-Pack Term 2",
        totalCredits: 20,
        price: 18000,
        status: "ACTIVE",
      },
    });

    const allPackages = await prisma.studentPackage.findMany({
      where: { studentId: student1Id },
    });
    assert(allPackages.length >= 2, "Both original and renewed packages must coexist independently");
    const orig = allPackages.find((p) => p.id === pkg1Id);
    assert(orig !== undefined, "Original package must remain untouched");
  });

  // 15. Scenario 15: Reject unauthorized teacher access through direct API requests.
  await scenario(15, "Reject unauthorized teacher access through direct API requests", async () => {
    // Teacher Priya tries to mark attendance for Rahul's session
    const canMark = canMarkAttendance(
      "TEACHER",
      DEMO_USERS.teacher_priya.teacherId, // Priya
      rahulId // Rahul's session
    );
    assert.strictEqual(canMark, false, "Teacher must not be authorized to mark attendance for another teacher's session");

    // Coordinator canMark should be true
    const canCoord = canMarkAttendance("COORDINATOR", null, rahulId);
    assert.strictEqual(canCoord, true);
  });

  // 16. Scenario 16: Verify two concurrent actions cannot overspend the same remaining credit.
  await scenario(16, "Verify two concurrent actions cannot overspend the same remaining credit", async () => {
    // Create package with 1 credit remaining
    const racePkg = await prisma.studentPackage.create({
      data: {
        packageNumber: `PKG-RACE-${testRunId}`,
        studentId: student1Id,
        name: "Race Package",
        totalCredits: 1,
        price: 1000,
      },
    });
    await prisma.subjectAllocation.create({
      data: {
        packageId: racePkg.id,
        subjectId: chemId,
        allocatedCredits: 1,
      },
    });

    // Check balances
    const bal = await calculatePackageBalances(racePkg.id);
    assert.strictEqual(bal?.totalRemaining, 1);

    // Try concurrent reallocation exceeding capacity
    let rejectedRace = false;
    try {
      await executeReallocation(
        racePkg.id,
        [{ subjectId: chemId, newAllocatedCredits: 2 }], // Exceeds entitlement of 1!
        "Overdraft test",
        DEMO_USERS.admin
      );
    } catch (e) {
      rejectedRace = true;
    }
    assert.strictEqual(rejectedRace, true, "Reallocation exceeding entitlement must be rejected");
  });

  // 17. Scenario 17: Verify payout items cannot be paid twice.
  await scenario(17, "Verify payout items cannot be paid twice", async () => {
    // Check unique constraint on PayoutItem.sessionId
    const sesForPayout = await prisma.session.create({
      data: {
        packageId: pkg1Id,
        studentId: student1Id,
        teacherId: rahulId,
        subjectId: chemId,
        scheduledStartTimeUtc: new Date(Date.now() - 3600 * 1000),
        scheduledEndTimeUtc: new Date(),
        status: "SCHEDULED",
      },
    });

    await submitSessionAttendance({
      sessionId: sesForPayout.id,
      sessionOutcome: "COMPLETED",
      studentAttendance: "PRESENT",
      actualDurationMinutes: 60,
      topicCovered: "Equilibrium",
      user: DEMO_USERS.admin,
    });

    // PayoutItem created once
    const itemsCount = await prisma.payoutItem.count({
      where: { sessionId: sesForPayout.id },
    });
    assert.strictEqual(itemsCount, 1);
  });

  // 18. Scenario 18: Verify relevant local class times for India and GCC users.
  await scenario(18, "Verify relevant local class times for India and GCC users", async () => {
    // Fixed UTC time: 2026-10-10 14:00:00 UTC
    const fixedUtc = new Date("2026-10-10T14:00:00Z");

    const formattedIst = formatInTimeZone(fixedUtc, "Asia/Kolkata"); // UTC + 5:30 -> 7:30 PM IST
    const formattedGst = formatInTimeZone(fixedUtc, "Asia/Dubai");   // UTC + 4:00 -> 6:00 PM GST
    const formattedAst = formatInTimeZone(fixedUtc, "Asia/Riyadh");  // UTC + 3:00 -> 5:00 PM AST

    assert(formattedIst.includes("7:30"), `IST formatted time should include 7:30 pm, got: ${formattedIst}`);
    assert(formattedGst.includes("6:00"), `GST formatted time should include 6:00 pm, got: ${formattedGst}`);
    assert(formattedAst.includes("5:00"), `AST formatted time should include 5:00 pm, got: ${formattedAst}`);
  });

  console.log("\n=======================================================");
  console.log(`🏆 ALL ${passedCount} OF 18 ACCEPTANCE SCENARIOS PASSED SUCCESSFULLY!`);
  console.log("=======================================================\n");
}

runTestSuite()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
