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
        name: "Shamrood",
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
  

  // 5. Trainers
  await prisma.teacher.createMany({
    data: [
  {
    name: "Maha SulaimaN",
    email: "mahasulaiman99@gmail.com",
    phone: "9061943670",
    subjects: "Mathematics",
    grades: "8 -plus 2",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Nishana K L",
    email: "nishana.nichu015@gmail.com",
    phone: "7909224110",
    subjects: "Physics",
    grades: "+1 +2 degree",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Shilpa Krishnan",
    email: "shilpakrishnan2511@gmail.com",
    phone: "8590830775",
    subjects: "English",
    grades: "8,9,10, +1, +2",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Ayesha Siddiqa",
    email: "ayeshasiddiqa7650@gmail.com",
    phone: "9845695446",
    subjects: "Biology",
    grades: "Class 8 - Class 12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "NADEERA K P",
    email: "saleemnadeera8899@gmail.com",
    phone: "7510914741",
    subjects: "Hindi, Maths, Social science & Chemistry",
    grades: "9 & 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Hibanourin K K",
    email: "hibanourin.98@gmail.com",
    phone: "9447909621",
    subjects: "Chemistry",
    grades: "HS, HSST",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Jasna vallanchira",
    email: "jasnaramiz@gmail.com",
    phone: "7356096323",
    subjects: "Social science, English",
    grades: "1 to 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Nawar",
    email: "nawa@gmail.com",
    phone: "9946856229",
    subjects: "Mathematics, English",
    grades: "6 to 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Neha Nazeer",
    email: "nehanazdxb@gmail.com",
    phone: "7356331044",
    subjects: "Chemistry",
    grades: "9,10,11 and 12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Thabsheera Shery P",
    email: "nb151158@gmail.com",
    phone: "9074584764",
    subjects: "Maths",
    grades: "1-10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Shameema P",
    email: "pshameema260@gmail.com",
    phone: "9562537430",
    subjects: "Biology (Botony&Zoology) Hindi, Chemistry",
    grades: "6-12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Ayisha finu",
    email: "ayshafinu20@gmail.com",
    phone: "8078261328",
    subjects: "Mathematics",
    grades: "1 to 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Fathimathu Shahara",
    email: "fathimathushahara404134@gamil.com",
    phone: "9633952640",
    subjects: "Biology,Chemistry",
    grades: "8,9&10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "RAJITHA PV",
    email: "rajithapv1234@gmail.com",
    phone: "9400038649",
    subjects: "Teach both Biology and Chemistry for 9&10th and General Science from grade 6-8 classes",
    grades: "6 to 10th",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "IHSAN KC",
    email: "kcihsan@gmail.com",
    phone: "9544089076",
    subjects: "Chemistry",
    grades: "10-12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Ranjitha c",
    email: "ranjitharanjuraj19@gmail.com",
    phone: "7025356127",
    subjects: "Physics and chemistry",
    grades: "7 to +2",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Fathima Febi E",
    email: "febiefathima@gmail.com",
    phone: "9074531210",
    subjects: "All subject",
    grades: "1-10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Aswathy.A",
    email: "aswathyasokan002@gmail.com",
    phone: "8592027791",
    subjects: "Malayalam",
    grades: "1 to 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Fathima Ifna",
    email: "fathima.ifna90@gmail.com",
    phone: "9061358003",
    subjects: "Biology",
    grades: "+1&+2",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "ASWATHI B",
    email: "aswathibiju425@gmail.com",
    phone: "9074450683",
    subjects: "English and Social science",
    grades: "5 to +2",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Ashna Rajeevan",
    email: "ashnarajeevan241@gmail.com",
    phone: "8547013677",
    subjects: "Physics",
    grades: "7 to plus 2",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Zanha Meharin",
    email: "meharinzanha@gmail.com",
    phone: "7666843494",
    subjects: "Hindi",
    grades: "Till class 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Farhana Sherin",
    email: "farhanasherin8808@gmail.com",
    phone: "8589880865",
    subjects: "Computer application",
    grades: "High school and higher secondary",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Nithin Kumar Rai R",
    email: "nithinkumarrai99@gmail.com",
    phone: "7356098771",
    subjects: "Mathematics",
    grades: "Class 5 to 12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Vafa Pv",
    email: "pv.vafa@gmail.com",
    phone: "7902452695",
    subjects: "Arabic & Social science",
    grades: "1 to 10 std",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Shameema tk",
    email: "shameematk1000@gmail.com",
    phone: "7012093876",
    subjects: "Hindi",
    grades: "Kg to 10th",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Aswani P",
    email: "aswanivas2807@gmail.com",
    phone: "9961597896",
    subjects: "Physics , Social Science",
    grades: "Grade 1-7 all subjects and High school Physics Social and Biology",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Nihal Moideen CTP",
    email: "nmcwdr@gmail.com",
    phone: "+918075700853",
    subjects: "Zoology, Biology",
    grades: "10-12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Asma M",
    email: "asma.muthuvana@gmail.com",
    phone: "9946364360",
    subjects: "Maths",
    grades: "10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "ANJANA A",
    email: "anjanarajendran7620@gmail.com",
    phone: "9745624823",
    subjects: "Science",
    grades: "UP,HS,HSS",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Riswana Narkkees S",
    email: "riswananarkkeesskd1234@gmail.com",
    phone: "8547197263",
    subjects: "Primary students all subject except Hindi",
    grades: "4-7",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "SNEHA S NAIR",
    email: "snehasnair200@gmail.com",
    phone: "8281521358",
    subjects: "Maths,Physics,Biology,Computer Science,Coding",
    grades: "Till class 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "MARIYA BENNY K",
    email: "mariyabennyk2325@gmail.com",
    phone: "7736752899",
    subjects: "Mathematics",
    grades: "Class 6,7, 8, Class 11",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Vipanya k",
    email: "vipanyak02@gmail.com",
    phone: "9539501019",
    subjects: "Physics",
    grades: "Up, hs, hss",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Sreelakshmi KS",
    email: "sreelakshmiksmenon@gmail.com",
    phone: "8137983347",
    subjects: "Maths",
    grades: "Highschool and higher secondary",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Adithya",
    email: "id4adithya@gmail.com",
    phone: "6238958133",
    subjects: "Hindi",
    grades: "1 to 9",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Fathima husna kp",
    email: "fathimahusnakp67@gmail.com",
    phone: "7012134417",
    subjects: "Science and social science",
    grades: "High school, Higher secondary",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Gayatri Mukhi",
    email: "gayatrimukhibluebell@gmail.com",
    phone: "7990704159",
    subjects: "French, science, english, hindi, sanskrit",
    grades: "1-12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Akhila. V",
    email: "akhilamaya02@gmail.com",
    phone: "7902252628",
    subjects: "Socialscience and malayalam",
    grades: "5 to 8",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Ramseena",
    email: "ramseenashaijal82@gmail.com",
    phone: "9961342360",
    subjects: "Maths",
    grades: "5-12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "SHAHANA PARVEEN",
    email: "shahanaparveen212@gmail.com",
    phone: "9496919855",
    subjects: "Arabic",
    grades: "KG to 8",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Aparna",
    email: "aparnaappu64557@gmail.com",
    phone: "9633356431",
    subjects: "Social science ( also all subjects)",
    grades: "5- 12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Arsha P",
    email: "arshap2006@gmail.com",
    phone: "9656055985",
    subjects: "Social science,Basic science",
    grades: "Upto class 12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Sandra vp",
    email: "sandrarajesh92@gmail.com",
    phone: "8281405158",
    subjects: "English",
    grades: "1- 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "SAMVRIDHA SUNIL",
    email: "samvridha2004@gmail.com",
    phone: "9497476914",
    subjects: "Maths",
    grades: "4-7",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Fathima hiba",
    email: "fathimahibafhb@gmail.com",
    phone: "9447919482",
    subjects: "Mathematics",
    grades: "KG to 10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Shamla",
    email: "shamlanizam1914@gmail.com",
    phone: "7034661221",
    subjects: "Biology, science, Evs, English",
    grades: "1 - 12 th grades",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Nikita",
    email: "nikitaparmar541@gmail.com",
    phone: "9671544766",
    subjects: "Mathematics",
    grades: "2nd to 12th",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Rinshida MK",
    email: "rinshidamk1@gmail.com",
    phone: "7034280806",
    subjects: "Chemistry(grade:8-10),General science:(grade5-7)",
    grades: "5-10",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Aysha minha",
    email: "nunnununnu2726@gmail.com",
    phone: "8714102409",
    subjects: "English,E.v.s, Hindi, malayalam",
    grades: "Upto 3",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Fathima fidha c",
    email: "fathimafidhanarath@gmail.com",
    phone: "9539220232",
    subjects: "Arabic",
    grades: "Kg to 5th",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Pravya P",
    email: "pravyapprakash004@gmail.com",
    phone: "8075107275",
    subjects: "Chemistry and physics",
    grades: "1 to plus two",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "Anagha S",
    email: "anaghassanil@gmail.com",
    phone: "7594930908",
    subjects: "Chemistry",
    grades: "7-12",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "MURSHIDA SUMAYYA",
    email: "murshidasumi@gmail.com",
    phone: "9847637546",
    subjects: "English, science, arabic, maths",
    grades: "1-7",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  },
  {
    name: "SITHARA PARVEEN",
    email: "sitharaparveen1999@gmail.com",
    phone: "8593942285",
    subjects: "MATHEMATICS",
    grades: "5th to +2",
    country: "India",
    timeZone: "Asia/Kolkata",
    active: true,
    defaultRate: 500,
  }
    ]
  });

  console.log("✅ Seeded Trainers.");

  console.log(
    process.env.NODE_ENV === "production"
      ? "🎉 Initialisation complete. Sign in as admin@xellotuition.com with the SEED_ADMIN_PASSWORD value, then change it under My Account."
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
