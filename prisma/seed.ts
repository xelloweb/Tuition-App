import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Xello Tuition Clean Initialization...");

  // 1. Clean existing records in correct relation order
  await prisma.auditLog.deleteMany();
  await prisma.parentConcern.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.studentProgress.deleteMany();
  await prisma.payoutItem.deleteMany();
  await prisma.payoutRun.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceInstalment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.attendanceRevision.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.session.deleteMany();
  await prisma.creditLedger.deleteMany();
  await prisma.subjectAllocation.deleteMany();
  await prisma.studentPackage.deleteMany();
  await prisma.packageTemplate.deleteMany();
  await prisma.subjectEnrollment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.user.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();

  console.log("🧹 Cleaned existing tables.");

  // 2. Base Subjects
  await prisma.subject.createMany({
    data: [
      { id: "sub-chem", name: "Chemistry", code: "CHEM", category: "Science", color: "#0284c7" },
      { id: "sub-eng", name: "English", code: "ENG", category: "Languages & Literature", color: "#16a34a" },
      { id: "sub-math", name: "Mathematics", code: "MATH", category: "STEM", color: "#7c3aed" },
      { id: "sub-phy", name: "Physics", code: "PHY", category: "Science", color: "#ea580c" },
      { id: "sub-bio", name: "Biology", code: "BIO", category: "Science", color: "#059669" },
    ],
  });

  console.log("✅ Seeded Base Subjects.");

  // 3. Package Templates
  await prisma.packageTemplate.createMany({
    data: [
      {
        id: "pkg-gcc-standard",
        name: "Standard GCC Package",
        totalCredits: 12,
        durationMinutes: 60,
        defaultPrice: 850,
        currency: "AED",
        notes: "12 hours per month across multiple subjects for GCC curriculum."
      },
      {
        id: "pkg-kerala-flex",
        name: "Kerala Board Flexi-Pack",
        totalCredits: 20,
        durationMinutes: 60,
        defaultPrice: 12000,
        currency: "INR",
        notes: "20 hours total, no expiry, for intense exam prep across subjects."
      },
    ],
  });
  console.log("✅ Seeded Base Package Templates.");

  // 4. Admin Users
  const passwordHash = await bcrypt.hash("demo123", 12);

  await prisma.user.createMany({
    data: [
      {
        id: "usr-admin",
        name: "Devanand Nambiar (Admin / Owner)",
        email: "admin@xellotuition.com",
        role: "OWNER",
        passwordHash,
      },
      {
        id: "usr-coord",
        name: "Aisha Nair (Academic Coordinator)",
        email: "coordinator@xellotuition.com",
        role: "COORDINATOR",
        passwordHash,
      },
      {
        id: "usr-accounts",
        name: "Joseph Thomas (Accounts Manager)",
        email: "accounts@xellotuition.com",
        role: "ACCOUNTS",
        passwordHash,
      },
    ],
  });
  console.log("✅ Seeded Admin & Coordinator Users.");
  
  console.log("🎉 Clean Initialization Complete! You can now log in with admin@xellotuition.com and password demo123.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
