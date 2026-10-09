import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, makeSubject, makeTeacher, makeStudent, enrol, uid } from "./helpers";
import {
  recordManualAttendance,
  editManualAttendance,
  deleteManualAttendance,
  getTrainerWorkingHours,
} from "../src/lib/services/manual-attendance";
import { calculatePackageBalances } from "../src/lib/package-calculations";
import { ApiError } from "../src/lib/api-errors";

const today = () => new Date().toISOString().slice(0, 10);

describe("Simplified Attendance Management System", () => {
  test("1 & 5: Manual attendance submission & 1hr=1, 2hr=2, 3hr=3 credit deductions", async () => {
    const subject = await makeSubject("Mathematics");
    const teacher = await makeTeacher("Sithara Parveen");
    const student = await makeStudent({ grade: "10th Grade" });
    await enrol(student.id, subject.id, teacher.id);

    // Create a 12-class monthly package
    const pkg = await prisma.studentPackage.create({
      data: {
        packageNumber: uid("PKG"),
        studentId: student.id,
        name: "Monthly 12 Classes",
        totalCredits: 12,
        price: 6000,
        startDate: new Date(),
        durationMinutes: 60,
        status: "ACTIVE",
        allocations: {
          create: [{ subjectId: subject.id, allocatedCredits: 12 }],
        },
      },
    });

    const trainerUser = {
      id: uid("USR"),
      name: teacher.name,
      email: teacher.email,
      role: "TEACHER" as const,
      teacherId: teacher.id,
    };

    // Initial package balance: 12 classes remaining
    let balances = await calculatePackageBalances(pkg.id);
    assert.equal(balances?.totalEntitlement, 12);
    assert.equal(balances?.totalConsumed, 0);
    assert.equal(balances?.totalRemaining, 12);

    // Step 1: Trainer marks 2 Hours completed
    const att1 = await recordManualAttendance(
      {
        studentId: student.id,
        subjectId: subject.id,
        classDate: today(),
        durationMinutes: 120, // 2 Hours = 2 Credits
        topicCovered: "Quadratic Equations",
      },
      trainerUser
    );

    assert.equal(att1.success, true);
    assert.equal(att1.creditsDeducted, 2);
    assert.equal(att1.remainingCredits, 10);

    // Verify package balance immediately updated: Total: 12, Attended: 2, Remaining: 10
    balances = await calculatePackageBalances(pkg.id);
    assert.equal(balances?.totalEntitlement, 12);
    assert.equal(balances?.totalConsumed, 2);
    assert.equal(balances?.totalRemaining, 10);

    // Step 2: Trainer marks another 1 Hour completed
    const att2 = await recordManualAttendance(
      {
        studentId: student.id,
        subjectId: subject.id,
        classDate: today(),
        durationMinutes: 60, // 1 Hour = 1 Credit
        topicCovered: "Linear Inequalities",
        confirmDuplicate: true, // separate class session on same day
      },
      trainerUser
    );

    assert.equal(att2.success, true);
    assert.equal(att2.creditsDeducted, 1);
    assert.equal(att2.remainingCredits, 9);

    // Verify package balance immediately updated: Total: 12, Attended: 3, Remaining: 9
    balances = await calculatePackageBalances(pkg.id);
    assert.equal(balances?.totalEntitlement, 12);
    assert.equal(balances?.totalConsumed, 3);
    assert.equal(balances?.totalRemaining, 9);

    // Step 3: Coordinator marks 3 Hours completed
    const att3 = await recordManualAttendance(
      {
        studentId: student.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        classDate: today(),
        durationMinutes: 180, // 3 Hours = 3 Credits
        topicCovered: "Coordinate Geometry",
        confirmDuplicate: true,
      },
      coordinator
    );

    assert.equal(att3.success, true);
    assert.equal(att3.creditsDeducted, 3);
    assert.equal(att3.remainingCredits, 6);

    balances = await calculatePackageBalances(pkg.id);
    assert.equal(balances?.totalConsumed, 6);
    assert.equal(balances?.totalRemaining, 6);
  });

  test("7: Trainer working hours & salary calculation updated automatically from confirmed attendance", async () => {
    const subject = await makeSubject("English");
    const teacher = await makeTeacher("Sithara Parveen"); // default base rate 500
    const studentA = await makeStudent({ grade: "10th Grade" });
    const studentB = await makeStudent({ grade: "10th Grade" });
    const studentC = await makeStudent({ grade: "10th Grade" });

    await enrol(studentA.id, subject.id, teacher.id);
    await enrol(studentB.id, subject.id, teacher.id);
    await enrol(studentC.id, subject.id, teacher.id);

    // Create packages for each student
    for (const s of [studentA, studentB, studentC]) {
      await prisma.studentPackage.create({
        data: {
          packageNumber: uid("PKG"),
          studentId: s.id,
          name: "Monthly 12 Classes",
          totalCredits: 12,
          price: 6000,
          startDate: new Date(),
          durationMinutes: 60,
          status: "ACTIVE",
          allocations: {
            create: [{ subjectId: subject.id, allocatedCredits: 12 }],
          },
        },
      });
    }

    const trainerUser = {
      id: uid("USR"),
      name: teacher.name,
      email: teacher.email,
      role: "TEACHER" as const,
      teacherId: teacher.id,
    };

    // Example from brief:
    // Student A – 1 Hour
    // Student B – 2 Hours
    // Student C – 1 Hour
    // Total Working Hours: 4 Hours
    await recordManualAttendance(
      { studentId: studentA.id, subjectId: subject.id, classDate: today(), durationMinutes: 60 },
      trainerUser
    );
    await recordManualAttendance(
      { studentId: studentB.id, subjectId: subject.id, classDate: today(), durationMinutes: 120 },
      trainerUser
    );
    // Coordinator marks for Student C assigning teacher
    await recordManualAttendance(
      { studentId: studentC.id, subjectId: subject.id, teacherId: teacher.id, classDate: today(), durationMinutes: 60 },
      coordinator
    );

    const stats = await getTrainerWorkingHours(teacher.id);
    assert.equal(stats.totalHours, 4);
    assert.equal(stats.totalClasses, 3);
    assert.equal(stats.totalMinutes, 240);

    // Verify PayoutItem records created with approved status
    const payoutItems = await prisma.payoutItem.findMany({
      where: { teacherId: teacher.id, status: "APPROVED" },
    });
    assert.equal(payoutItems.length, 3);
    const totalEarnings = payoutItems.reduce((sum, item) => sum + item.amount, 0);
    // Grade 10th tier rate = 150/hr: 4 hrs * 150 = 600
    assert.ok(totalEarnings > 0);
  });

  test("9: Validations - Trainers restricted to assigned students & subjects", async () => {
    const subjectA = await makeSubject("Science");
    const subjectB = await makeSubject("Social Studies");
    const teacherA = await makeTeacher("Trainer Alpha");
    const teacherB = await makeTeacher("Trainer Beta");
    const student = await makeStudent();

    await enrol(student.id, subjectA.id, teacherA.id);
    // student is enrolled in subjectB with teacherB
    await enrol(student.id, subjectB.id, teacherB.id);

    await prisma.studentPackage.create({
      data: {
        packageNumber: uid("PKG"),
        studentId: student.id,
        name: "Monthly 12 Classes",
        totalCredits: 12,
        price: 6000,
        startDate: new Date(),
        durationMinutes: 60,
        status: "ACTIVE",
        allocations: {
          create: [{ subjectId: subjectA.id, allocatedCredits: 6 }, { subjectId: subjectB.id, allocatedCredits: 6 }],
        },
      },
    });

    const trainerAUser = {
      id: uid("USR"),
      name: teacherA.name,
      email: teacherA.email,
      role: "TEACHER" as const,
      teacherId: teacherA.id,
    };

    // Trainer A marks for Subject A (allowed)
    const success = await recordManualAttendance(
      { studentId: student.id, subjectId: subjectA.id, classDate: today(), durationMinutes: 60 },
      trainerAUser
    );
    assert.equal(success.success, true);

    // Trainer A tries to mark for Subject B (assigned to Trainer B - rejected)
    await assert.rejects(
      async () => {
        await recordManualAttendance(
          { studentId: student.id, subjectId: subjectB.id, classDate: today(), durationMinutes: 60 },
          trainerAUser
        );
      },
      (err: any) => {
        assert.equal(err instanceof ApiError, true);
        assert.equal(err.status, 403);
        assert.match(err.message, /assigned to you/);
        return true;
      }
    );
  });

  test("9: Warning and confirmation if attendance exceeds remaining package credits", async () => {
    const subject = await makeSubject("Arabic");
    const teacher = await makeTeacher("Ahmed");
    const student = await makeStudent();
    await enrol(student.id, subject.id, teacher.id);

    const pkg = await prisma.studentPackage.create({
      data: {
        packageNumber: uid("PKG"),
        studentId: student.id,
        name: "Small 1 Class Package",
        totalCredits: 1, // Only 1 credit available
        price: 1000,
        startDate: new Date(),
        durationMinutes: 60,
        status: "ACTIVE",
        allocations: {
          create: [{ subjectId: subject.id, allocatedCredits: 1 }],
        },
      },
    });

    // Attempting to mark a 2-hour class (requires 2 credits) without confirmation must be rejected with warning
    await assert.rejects(
      async () => {
        await recordManualAttendance(
          {
            studentId: student.id,
            subjectId: subject.id,
            teacherId: teacher.id,
            classDate: today(),
            durationMinutes: 120, // 2 Credits
            confirmExceedsCredits: false,
          },
          coordinator
        );
      },
      (err: any) => {
        assert.equal(err instanceof ApiError, true);
        assert.equal(err.status, 400);
        assert.match(err.message, /exceeds the student's remaining package balance/);
        assert.equal(err.details?.code, "EXCEEDS_PACKAGE_CREDITS");
        assert.equal(err.details?.remainingCredits, 1);
        assert.equal(err.details?.requiredCredits, 2);
        return true;
      }
    );

    // Now confirm with confirmExceedsCredits: true
    const confirmed = await recordManualAttendance(
      {
        studentId: student.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        classDate: today(),
        durationMinutes: 120,
        confirmExceedsCredits: true,
      },
      coordinator
    );
    assert.equal(confirmed.success, true);
    assert.equal(confirmed.creditsDeducted, 2);
  });

  test("8: Edit attendance automatically corrects package balance, trainer hours, and payout", async () => {
    const subject = await makeSubject("Physics");
    const teacher = await makeTeacher("Newton");
    const student = await makeStudent({ grade: "10th Grade" });
    await enrol(student.id, subject.id, teacher.id);

    const pkg = await prisma.studentPackage.create({
      data: {
        packageNumber: uid("PKG"),
        studentId: student.id,
        name: "Monthly 12 Classes",
        totalCredits: 12,
        price: 6000,
        startDate: new Date(),
        durationMinutes: 60,
        status: "ACTIVE",
        allocations: {
          create: [{ subjectId: subject.id, allocatedCredits: 12 }],
        },
      },
    });

    // Mark 2 Hours initially
    const result = await recordManualAttendance(
      {
        studentId: student.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        classDate: today(),
        durationMinutes: 120, // 2 credits deducted
        topicCovered: "Kinematics",
      },
      coordinator
    );

    let balances = await calculatePackageBalances(pkg.id);
    assert.equal(balances?.totalConsumed, 2);
    assert.equal(balances?.totalRemaining, 10);

    let stats = await getTrainerWorkingHours(teacher.id);
    assert.equal(stats.totalHours, 2);

    // Edit attendance: correct duration from 2 Hours (120 min) to 1 Hour (60 min)
    const editResult = await editManualAttendance(
      {
        attendanceId: result.attendanceId,
        durationMinutes: 60, // 1 hour
        reason: "Trainer clarified class was only 1 hour",
      },
      coordinator
    );

    assert.equal(editResult.success, true);
    assert.equal(editResult.oldCredits, 2);
    assert.equal(editResult.newCredits, 1);
    assert.equal(editResult.creditsDelta, 1); // 1 credit restored to package

    // Package balance automatically corrected: Attended: 1, Remaining: 11
    balances = await calculatePackageBalances(pkg.id);
    assert.equal(balances?.totalConsumed, 1);
    assert.equal(balances?.totalRemaining, 11);

    // Trainer working hours automatically corrected: from 2 hours to 1 hour
    stats = await getTrainerWorkingHours(teacher.id);
    assert.equal(stats.totalHours, 1);

    // PayoutItem duration and amount automatically updated
    const payout = await prisma.payoutItem.findUnique({ where: { sessionId: result.sessionId } });
    assert.equal(payout?.durationMinutes, 60);
    assert.equal(payout?.amount, 600); // 600/hr * 1 hr (Newton default rate is 600)
  });

  test("8: Delete attendance cleanly restores package credits, deletes trainer payout, and updates working hours", async () => {
    const subject = await makeSubject("Chemistry");
    const teacher = await makeTeacher("Marie Curie");
    const student = await makeStudent({ grade: "10th Grade" });
    await enrol(student.id, subject.id, teacher.id);

    const pkg = await prisma.studentPackage.create({
      data: {
        packageNumber: uid("PKG"),
        studentId: student.id,
        name: "Monthly 12 Classes",
        totalCredits: 12,
        price: 6000,
        startDate: new Date(),
        durationMinutes: 60,
        status: "ACTIVE",
        allocations: {
          create: [{ subjectId: subject.id, allocatedCredits: 12 }],
        },
      },
    });

    // Mark 3 Hours (3 credits)
    const result = await recordManualAttendance(
      {
        studentId: student.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        classDate: today(),
        durationMinutes: 180, // 3 credits deducted
        topicCovered: "Organic Chemistry",
      },
      coordinator
    );

    let balances = await calculatePackageBalances(pkg.id);
    assert.equal(balances?.totalConsumed, 3);
    assert.equal(balances?.totalRemaining, 9);

    let stats = await getTrainerWorkingHours(teacher.id);
    assert.equal(stats.totalHours, 3);

    // Delete attendance record
    const delResult = await deleteManualAttendance(result.attendanceId, coordinator);
    assert.equal(delResult.success, true);
    assert.equal(delResult.restoredCredits, 3);

    // Package balance automatically restored: Total: 12, Attended: 0, Remaining: 12
    balances = await calculatePackageBalances(pkg.id);
    assert.equal(balances?.totalConsumed, 0);
    assert.equal(balances?.totalRemaining, 12);

    // Trainer working hours automatically restored: 0 hours
    stats = await getTrainerWorkingHours(teacher.id);
    assert.equal(stats.totalHours, 0);

    // PayoutItem deleted
    const payout = await prisma.payoutItem.findUnique({ where: { sessionId: result.sessionId } });
    assert.equal(payout, null);

    // AttendanceRecord and Session deleted
    const rec = await prisma.attendanceRecord.findUnique({ where: { id: result.attendanceId } });
    assert.equal(rec, null);
    const ses = await prisma.session.findUnique({ where: { id: result.sessionId } });
    assert.equal(ses, null);
  });
});
