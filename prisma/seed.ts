import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Bootstrap seed: base subjects, package templates and the first staff
 * accounts for an EMPTY database. It is safe to run on every deploy:
 *
 * - If the database already has users or students it does nothing.
 * - It wipes existing data only when ALLOW_DB_RESET="wipe-all-data" is set
 *   (never leave that set: every run would delete all records).
 * - In production the staff password must come from SEED_ADMIN_PASSWORD
 *   (12+ characters); the public demo password is used only locally.
 */
const RESET_PHRASE = "wipe-all-data";

function initialPassword(): string {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (process.env.NODE_ENV === "production") {
    if (fromEnv.length < 12 || fromEnv === "demo123") {
      throw new Error("Set SEED_ADMIN_PASSWORD (12+ characters) to create the first staff accounts in production.");
    }
    return fromEnv;
  }
  return fromEnv || "demo123";
}

async function wipeAllData() {
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
  await prisma.timetableSlot.deleteMany();
  await prisma.idempotencyKey.deleteMany();
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
}

async function main() {
  const [users, students] = await Promise.all([prisma.user.count(), prisma.student.count()]);
  const resetRequested = process.env.ALLOW_DB_RESET === RESET_PHRASE;
  if ((users > 0 || students > 0) && !resetRequested) {
    console.log(`ℹ️  Database already initialised (${users} users, ${students} students). Seed skipped; nothing was changed.`);
    return;
  }
  const password = initialPassword();
  if (resetRequested) {
    console.warn(`⚠️  ALLOW_DB_RESET=${RESET_PHRASE}: deleting ALL existing records. Remove this setting after this run.`);
    await wipeAllData();
  }
  console.log("🌱 Starting Xello Tuition initialisation...");


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
  const passwordHash = await bcrypt.hash(password, 12);

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
  
  console.log(
    process.env.NODE_ENV === "production"
      ? "🎉 Initialisation complete. Sign in as admin@xellotuition.com with the SEED_ADMIN_PASSWORD value, then change it under Account."
      : `🎉 Initialisation complete. Local sign-in: admin@xellotuition.com / ${password === "demo123" ? "demo123" : "(SEED_ADMIN_PASSWORD)"}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
