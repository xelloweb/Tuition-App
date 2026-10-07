import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const force = process.argv.includes("--force");

  if (!force) {
    const alreadyRun = await prisma.auditLog.findFirst({
      where: { action: "PURGE_INITIAL_STUDENTS_V1" },
    });
    if (alreadyRun) {
      console.log("Cleanup check: Student purge was already executed on this database.");
      return;
    }
  }

  console.log("🧹 Removing all students and associated records...");

  // 1. Delete dependent child records
  await prisma.attendanceCorrectionRequest.deleteMany();
  await prisma.attendanceRevision.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.payoutItem.deleteMany();
  await prisma.session.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.creditLedger.deleteMany();
  await prisma.subjectAllocation.deleteMany();
  await prisma.studentPackage.deleteMany();
  await prisma.subjectEnrollment.deleteMany();
  await prisma.invoiceInstalment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.parentConcern.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.studentProgress.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.admissionDraft.deleteMany();

  // 2. Delete students and unlinked guardians
  const deletedStudents = await prisma.student.deleteMany();
  const deletedGuardians = await prisma.guardian.deleteMany();

  // 3. Record audit log marker so future deploys do not touch real students
  await prisma.auditLog.create({
    data: {
      entityType: "STUDENT",
      entityId: "all",
      action: "PURGE_INITIAL_STUDENTS_V1",
      actorRole: "SYSTEM",
      actorName: "Initial Student Purge",
      details: JSON.stringify({
        purgedCount: deletedStudents.count,
        purgedAt: new Date().toISOString(),
      }),
    },
  });

  // 4. Ensure all teachers have the standard hourly pay rates
  const standardGradeRates = JSON.stringify({
    PRIMARY: 150,
    MIDDLE: 150,
    SECONDARY: 150,
    TENTH: 150,
    PLUS_ONE: 200,
    PLUS_TWO: 200,
  });

  const teacherUpdate = await prisma.teacher.updateMany({
    data: {
      defaultRate: 150,
      gradeRates: standardGradeRates,
    },
  });

  console.log(`✅ Successfully removed ${deletedStudents.count} student(s) and ${deletedGuardians.count} guardian(s).`);
  console.log(`✅ Standard hourly pay rates maintained for ${teacherUpdate.count} trainers.`);
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
