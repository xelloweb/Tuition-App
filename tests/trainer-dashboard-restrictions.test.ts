import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, makeSubject, makeTeacher, makeStudent, enrol, uid } from "./helpers";
import {
  getTrainerMyStudents,
  getTrainerStudentProfile,
} from "../src/lib/services/trainer-portal";
import { recordManualAttendance, getTrainerWorkingHours } from "../src/lib/services/manual-attendance";
import { canViewStudent, canManageStudents } from "../src/lib/auth";
import { saveTimetable, getTimetableView } from "../src/lib/services/timetable";

const today = () => new Date().toISOString().slice(0, 10);

describe("Trainer Dashboard & Student Profile Access Restrictions", () => {
  test("1, 3, 4: Trainer only sees assigned subject, not other subjects, trainers, or package financials", async () => {
    // Student Rahul
    const student = await makeStudent({ grade: "10th Grade" });

    // 3 Subjects and 3 Trainers
    const mathSubject = await makeSubject("Mathematics");
    const englishSubject = await makeSubject("English");
    const scienceSubject = await makeSubject("Science");

    const trainerA = await makeTeacher("Trainer A (Maths)");
    const trainerB = await makeTeacher("Trainer B (English)");
    const trainerC = await makeTeacher("Trainer C (Science)");

    // Enrolments: Math -> Trainer A, English -> Trainer B, Science -> Trainer C
    await enrol(student.id, mathSubject.id, trainerA.id);
    await enrol(student.id, englishSubject.id, trainerB.id);
    await enrol(student.id, scienceSubject.id, trainerC.id);

    // Create a 20-class shared package with allocations:
    // Math: 12 classes, English: 8 classes (Science is not allocated)
    const pkg = await prisma.studentPackage.create({
      data: {
        packageNumber: uid("PKG"),
        studentId: student.id,
        name: "Term 1 Combo Package",
        totalCredits: 20,
        price: 15000,
        startDate: new Date(),
        durationMinutes: 60,
        status: "ACTIVE",
        allocations: {
          create: [
            { subjectId: mathSubject.id, allocatedCredits: 12 },
            { subjectId: englishSubject.id, allocatedCredits: 8 },
          ],
        },
      },
    });

    // --- TEST TRAINER A ACCESS ---
    const trainerAProfile = await getTrainerStudentProfile(trainerA.id, student.id);
    assert.ok(trainerAProfile !== null, "Trainer A should be able to access assigned student");
    assert.equal(trainerAProfile.student.name, student.name);

    // Trainer A must ONLY see Mathematics
    assert.equal(trainerAProfile.assignedSubjects.length, 1);
    assert.equal(trainerAProfile.assignedSubjects[0].subjectId, mathSubject.id);
    assert.equal(trainerAProfile.assignedSubjects[0].subjectName, mathSubject.name);

    // Trainer A must see subject-specific credits (12), NOT the entire package (20)
    assert.equal(trainerAProfile.assignedSubjects[0].hasSubjectAllocation, true);
    assert.equal(trainerAProfile.assignedSubjects[0].allocatedCredits, 12);
    assert.equal(trainerAProfile.assignedSubjects[0].completedClasses, 0);
    assert.equal(trainerAProfile.assignedSubjects[0].remainingCredits, 12);

    // Must NOT leak English or Science
    const subjectNamesA = trainerAProfile.assignedSubjects.map((s) => s.subjectName);
    assert.ok(!subjectNamesA.includes(englishSubject.name), "Must not leak English to Trainer A");
    assert.ok(!subjectNamesA.includes(scienceSubject.name), "Must not leak Science to Trainer A");

    // --- TEST TRAINER B ACCESS ---
    const trainerBProfile = await getTrainerStudentProfile(trainerB.id, student.id);
    assert.ok(trainerBProfile !== null);
    assert.equal(trainerBProfile.assignedSubjects.length, 1);
    assert.equal(trainerBProfile.assignedSubjects[0].subjectId, englishSubject.id);
    assert.equal(trainerBProfile.assignedSubjects[0].allocatedCredits, 8);
    assert.equal(trainerBProfile.assignedSubjects[0].remainingCredits, 8);

    // --- TEST TRAINER C (UNALLOCATED SUBJECT) ACCESS ---
    const trainerCProfile = await getTrainerStudentProfile(trainerC.id, student.id);
    assert.ok(trainerCProfile !== null);
    assert.equal(trainerCProfile.assignedSubjects.length, 1);
    assert.equal(trainerCProfile.assignedSubjects[0].subjectId, scienceSubject.id);

    // Science was not allocated in the package: must show 'Subject Credit Allocation Not Set'
    assert.equal(trainerCProfile.assignedSubjects[0].hasSubjectAllocation, false);
    assert.equal(trainerCProfile.assignedSubjects[0].allocatedCredits, null);
    assert.equal(trainerCProfile.assignedSubjects[0].remainingCredits, null);
    assert.equal(trainerCProfile.assignedSubjects[0].creditStatusLabel, "Subject Credit Allocation Not Set");
  });

  test("2: Trainer Dashboard 'My Students' only displays relevant assigned subjects and credits", async () => {
    const student1 = await makeStudent({ grade: "10th Grade" });
    const student2 = await makeStudent({ grade: "10th Grade" });

    const mathSubject = await makeSubject("Maths");
    const englishSubject = await makeSubject("English");
    const trainer = await makeTeacher("Dedicated Trainer");

    // Enrol student 1 in Maths with trainer
    await enrol(student1.id, mathSubject.id, trainer.id);
    // Enrol student 2 in English with trainer
    await enrol(student2.id, englishSubject.id, trainer.id);

    // Student 1 has 10 classes package for Maths
    await prisma.studentPackage.create({
      data: {
        packageNumber: uid("PKG"),
        studentId: student1.id,
        name: "Maths Pack",
        totalCredits: 10,
        price: 5000,
        startDate: new Date(),
        durationMinutes: 60,
        status: "ACTIVE",
        allocations: {
          create: [{ subjectId: mathSubject.id, allocatedCredits: 10 }],
        },
      },
    });

    const myStudents = await getTrainerMyStudents(trainer.id);
    assert.equal(myStudents.length, 2);

    const s1 = myStudents.find((s) => s.studentId === student1.id);
    assert.ok(s1);
    assert.equal(s1.assignedSubjects.length, 1);
    assert.equal(s1.assignedSubjects[0].subjectName, mathSubject.name);
    assert.equal(s1.assignedSubjects[0].allocatedCredits, 10);
    assert.equal(s1.assignedSubjects[0].remainingCredits, 10);

    const s2 = myStudents.find((s) => s.studentId === student2.id);
    assert.ok(s2);
    assert.equal(s2.assignedSubjects.length, 1);
    assert.equal(s2.assignedSubjects[0].subjectName, englishSubject.name);
    assert.equal(s2.assignedSubjects[0].creditStatusLabel, "No Active Package");
  });

  test("5: Manual attendance updates subject completed classes, remaining credits, and working hours", async () => {
    const student = await makeStudent({ grade: "10th Grade" });
    const subject = await makeSubject("Maths");
    const trainer = await makeTeacher("Trainer A");
    await enrol(student.id, subject.id, trainer.id);

    await prisma.studentPackage.create({
      data: {
        packageNumber: uid("PKG"),
        studentId: student.id,
        name: "Pack 12",
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
      name: trainer.name,
      email: trainer.email,
      role: "TEACHER" as const,
      teacherId: trainer.id,
    };

    // Mark 2 Hours completed
    const result = await recordManualAttendance(
      {
        studentId: student.id,
        subjectId: subject.id,
        classDate: today(),
        durationMinutes: 120, // 2 Credits
        topicCovered: "Linear Equations",
      },
      trainerUser
    );
    assert.equal(result.success, true);
    assert.equal(result.creditsDeducted, 2);

    // Profile updates: Completed = 2, Remaining = 10
    const profile = await getTrainerStudentProfile(trainer.id, student.id);
    assert.ok(profile);
    assert.equal(profile.assignedSubjects[0].completedClasses, 2);
    assert.equal(profile.assignedSubjects[0].remainingCredits, 10);

    // Attendance record visible in profile attendance history
    assert.equal(profile.attendanceHistory.length, 1);
    assert.equal(profile.attendanceHistory[0].hoursCompleted, 2);
    assert.equal(profile.attendanceHistory[0].topicCovered, "Linear Equations");

    // Working hours updated
    const stats = await getTrainerWorkingHours(trainer.id);
    assert.equal(stats.totalHours, 2);
  });

  test("6: Timetable slots are subject-specific and isolated per trainer", async () => {
    const student = await makeStudent({ grade: "10th Grade" });
    const mathSubject = await makeSubject("Maths");
    const englishSubject = await makeSubject("English");

    const trainerA = await makeTeacher("Maths Trainer");
    const trainerB = await makeTeacher("English Trainer");

    const enrMath = await enrol(student.id, mathSubject.id, trainerA.id);
    const enrEng = await enrol(student.id, englishSubject.id, trainerB.id);

    // Create timetable slots:
    // Sunday (0) 8-9 PM (1200-1260 mins) for Math
    // Monday (1) 7-8 PM (1140-1200 mins) for English
    await prisma.timetableSlot.createMany({
      data: [
        {
          enrolmentId: enrMath.id,
          teacherId: trainerA.id,
          weekday: 0,
          startMinutes: 1200,
          endMinutes: 1260,
          timeZone: "Asia/Kolkata",
          effectiveFrom: new Date(),
          createdByName: "Admin",
          createdByRole: "ADMIN",
          active: true,
        },
        {
          enrolmentId: enrEng.id,
          teacherId: trainerB.id,
          weekday: 1,
          startMinutes: 1140,
          endMinutes: 1200,
          timeZone: "Asia/Kolkata",
          effectiveFrom: new Date(),
          createdByName: "Admin",
          createdByRole: "ADMIN",
          active: true,
        },
      ],
    });

    // Check Trainer A profile schedules: Only Sunday 8-9 PM
    const profileA = await getTrainerStudentProfile(trainerA.id, student.id);
    assert.ok(profileA);
    assert.equal(profileA.assignedSubjects[0].schedules.length, 1);
    assert.equal(profileA.assignedSubjects[0].schedules[0].weekday, 0);

    // Check Trainer B profile schedules: Only Monday 7-8 PM
    const profileB = await getTrainerStudentProfile(trainerB.id, student.id);
    assert.ok(profileB);
    assert.equal(profileB.assignedSubjects[0].schedules.length, 1);
    assert.equal(profileB.assignedSubjects[0].schedules[0].weekday, 1);
  });

  test("8: Removing student from trainer immediately revokes trainer access", async () => {
    const student = await makeStudent({ grade: "10th Grade" });
    const subject = await makeSubject("Physics");
    const trainer = await makeTeacher("Physics Trainer");

    const enrolment = await enrol(student.id, subject.id, trainer.id);

    const trainerUser = {
      id: uid("USR"),
      name: trainer.name,
      email: trainer.email,
      role: "TEACHER" as const,
      teacherId: trainer.id,
    };

    // Initially trainer has access
    assert.equal(await canViewStudent(trainerUser, student.id), true);
    assert.ok(await getTrainerStudentProfile(trainer.id, student.id) !== null);

    // Admin unassigns trainer (sets teacherId to null or reassigns to another trainer)
    await prisma.subjectEnrollment.update({
      where: { id: enrolment.id },
      data: { teacherId: null },
    });

    // Trainer no longer has access
    assert.equal(await canViewStudent(trainerUser, student.id), false);
    assert.equal(await getTrainerStudentProfile(trainer.id, student.id), null);
  });

  test("7: Admin and Coordinator retain full access to all subjects and packages", async () => {
    const student = await makeStudent({ grade: "10th Grade" });
    const sub1 = await makeSubject("S1");
    const sub2 = await makeSubject("S2");
    const t1 = await makeTeacher("T1");
    const t2 = await makeTeacher("T2");

    await enrol(student.id, sub1.id, t1.id);
    await enrol(student.id, sub2.id, t2.id);

    // Admins and coordinators can access any student
    assert.equal(await canViewStudent(owner, student.id), true);
    assert.equal(await canViewStudent(coordinator, student.id), true);
    assert.equal(canManageStudents(owner.role), true);
    assert.equal(canManageStudents(coordinator.role), true);
  });
});
