import { PrismaClient } from "@prisma/client";
import { RAW_TSV } from "./students-raw-data";

const prisma = new PrismaClient();

interface ParsedStudent {
  name: string;
  phone: string;
  place: string;
  rawClass: string;
  grade: string;
  syllabus: string;
  days: string;
  time: string;
  rawAmount: string;
  amount: number;
  currency: string;
  rawPkg: string;
  credits: number;
  startDate: Date;
  rawSubjects: string;
  subjectNames: string[];
  trainerName: string;
  guardianName: string;
  guardianPhone: string;
}

function normalizeGrade(raw: string): string {
  const c = (raw || "").trim().toLowerCase();
  if (c.includes("12") || c.includes("+2") || c.includes("*2") || c.includes("vhse") || c.includes("xii")) {
    return "Plus Two (+2)";
  }
  if (c.includes("11") || c.includes("+1") || c.includes("plus one") || c.includes("xi")) {
    return "Plus One (+1)";
  }
  if (c.includes("10") || c.includes("x") || c.includes("sslc") || c.includes("year10")) {
    return "10th Grade";
  }
  if (c.includes("9") || c.includes("ix")) {
    return "9th Grade";
  }
  if (c.includes("8") || c.includes("viii")) {
    return "8th Grade";
  }
  if (c.includes("7") || c.includes("vii")) {
    return "7th Grade";
  }
  if (c.includes("6") || c.includes("vi")) {
    return "6th Grade";
  }
  if (c.includes("5") || c.includes("p5")) {
    return "5th Grade";
  }
  if (c.includes("4")) {
    return "4th Grade";
  }
  if (c.includes("3")) {
    return "3rd Grade";
  }
  if (c.includes("2")) {
    return "2nd Grade";
  }
  if (c.includes("1")) {
    return "1st Grade";
  }
  if (c.includes("kg")) {
    return "KG";
  }
  return raw ? raw.trim() : "10th Grade";
}

function detectCountryAndTimezone(place: string, phone: string): { country: string; timeZone: string } {
  const p = (place || "").toLowerCase();
  const ph = (phone || "").replace(/\s+/g, "");

  if (p.includes("qatar") || p.includes("doha") || ph.startsWith("00974") || ph.startsWith("+974")) {
    return { country: "Qatar", timeZone: "Asia/Qatar" };
  }
  if (p.includes("kuwait") || ph.startsWith("00965") || ph.startsWith("+965")) {
    return { country: "Kuwait", timeZone: "Asia/Kuwait" };
  }
  if (p.includes("bahrain") || ph.startsWith("00973") || ph.startsWith("+973")) {
    return { country: "Bahrain", timeZone: "Asia/Bahrain" };
  }
  if (p.includes("oman") || p.includes("muscat") || p.includes("sur") || ph.startsWith("+968") || ph.startsWith("00968")) {
    return { country: "Oman", timeZone: "Asia/Muscat" };
  }
  if (p.includes("saudi") || p.includes("riyadh") || ph.startsWith("+966") || ph.startsWith("00966")) {
    return { country: "Saudi Arabia", timeZone: "Asia/Riyadh" };
  }
  if (p.includes("dubai") || p.includes("abudhabi") || p.includes("sharjah") || p.includes("uae") || ph.startsWith("+971") || ph.startsWith("00971")) {
    return { country: "UAE", timeZone: "Asia/Dubai" };
  }
  if (p.includes("australia") || ph.startsWith("+61")) {
    return { country: "Australia", timeZone: "Australia/Sydney" };
  }
  if (p.includes("canada") || ph.startsWith("+1")) {
    return { country: "Canada", timeZone: "America/Toronto" };
  }
  if (p.includes("ireland") || ph.startsWith("+353")) {
    return { country: "Ireland", timeZone: "Europe/Dublin" };
  }
  if (p.includes("singapore") || ph.startsWith("+65")) {
    return { country: "Singapore", timeZone: "Asia/Singapore" };
  }
  if (p.includes("iceland")) {
    return { country: "Iceland", timeZone: "Atlantic/Reykjavik" };
  }
  return { country: "India", timeZone: "Asia/Kolkata" };
}

function cleanPhone(raw: string, country: string): string {
  if (!raw) return "+91 90000 00000";
  // take first number if split by / or ,
  const first = raw.split(/[/,]/)[0].trim();
  const digitsOnly = first.replace(/\D/g, "");

  if (first.startsWith("+")) {
    return `+${digitsOnly}`;
  }
  if (first.startsWith("00")) {
    return `+${digitsOnly.slice(2)}`;
  }
  if (country === "UAE") {
    if (digitsOnly.startsWith("971")) return `+${digitsOnly}`;
    if (digitsOnly.startsWith("05") || digitsOnly.startsWith("5")) {
      const trimmed = digitsOnly.startsWith("0") ? digitsOnly.slice(1) : digitsOnly;
      return `+971 ${trimmed}`;
    }
  }
  if (country === "Qatar") {
    if (digitsOnly.startsWith("974")) return `+${digitsOnly}`;
    return `+974 ${digitsOnly}`;
  }
  if (country === "Kuwait") {
    if (digitsOnly.startsWith("965")) return `+${digitsOnly}`;
    return `+965 ${digitsOnly}`;
  }
  if (country === "Bahrain") {
    if (digitsOnly.startsWith("973")) return `+${digitsOnly}`;
    return `+973 ${digitsOnly}`;
  }
  if (country === "Oman") {
    if (digitsOnly.startsWith("968")) return `+${digitsOnly}`;
    return `+968 ${digitsOnly}`;
  }
  if (country === "Saudi Arabia") {
    if (digitsOnly.startsWith("966")) return `+${digitsOnly}`;
    return `+966 ${digitsOnly}`;
  }
  if (country === "India") {
    if (digitsOnly.length === 10) return `+91 ${digitsOnly}`;
    if (digitsOnly.startsWith("91") && digitsOnly.length === 12) return `+${digitsOnly}`;
  }
  return `+${digitsOnly}`;
}

function parseStartDate(raw: string): Date {
  if (!raw) return new Date("2026-04-01");
  const parts = raw.split("/").map((p) => parseInt(p.trim(), 10));
  if (parts.length === 3) {
    const day = parts[0];
    const month = parts[1] - 1;
    let year = parts[2];
    if (year < 100) year = 2026;
    if (year < 2000) year = 2026;
    return new Date(Date.UTC(year, month, day, 4, 30, 0));
  }
  return new Date("2026-04-01");
}

function parsePackageCredits(rawPkg: string, rawDays: string): number {
  const p = (rawPkg || "").toLowerCase();
  if (p.includes("40 classes") || p.includes("10 classes/week") || p.includes("weekly 10 classes")) return 40;
  if (p.includes("32 classes") || (p.includes("20 classes physics") && p.includes("12 classes chemistry"))) return 32;
  if (p.includes("25 classes")) return 25;
  if (p.includes("24 classes") || p.includes("6classes/week") || p.includes("6 per week") || p.includes("6 days weekly") || p.includes("6 class per week")) return 24;
  if (p.includes("20 classes") || p.includes("5 classes/week") || p.includes("3 weeks(15 classes)") || p.includes("15 classes")) return 20;
  if (p.includes("16 classes") || p.includes("4 classes / week") || p.includes("4 classes/week")) return 16;
  if (p.includes("12 classes") || p.includes("3 classes/week") || p.includes("3 class per week") || p.includes("3 class in a week")) return 12;
  if (p.includes("10 classes")) return 10;
  if (p.includes("8 classes") || p.includes("2 class per week") || p.includes("2 classes/week") || p.includes("2 classes per week")) return 8;
  if (p.includes("5classes") || p.includes("5 classes")) return 5;
  if (p.includes("4 classes") || p.includes("1 class") || p.includes("weekly one") || p.includes("one class per week")) return 4;

  // Infer from days count
  if (rawDays) {
    const dayCount = rawDays.split(",").length;
    return Math.max(dayCount * 4, 12);
  }
  return 12;
}

function parseAmount(raw: string, country: string, credits: number): { amount: number; currency: string } {
  if (!raw) return { amount: credits * 250, currency: country === "Qatar" ? "QAR" : "INR" };
  const str = raw.toLowerCase().trim();
  if (str === "yes") return { amount: credits * 250, currency: "INR" };
  if (str === "250" && country === "Qatar") return { amount: 250, currency: "QAR" };

  const cleaned = str.replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  if (Number.isFinite(num) && num > 0) {
    const currency = country === "Qatar" && num < 1000 ? "QAR" : "INR";
    return { amount: Math.round(num), currency };
  }
  return { amount: credits * 250, currency: "INR" };
}

function parseSubjects(raw: string): string[] {
  if (!raw) return ["General Tuition"];
  const s = raw.toLowerCase();
  const result = new Set<string>();

  if (s.includes("math") || s.includes("mathematic")) result.add("Mathematics");
  if (s.includes("physic") || s.includes("phy")) result.add("Physics");
  if (s.includes("chem")) result.add("Chemistry");
  if (s.includes("bio") || s.includes("botony") || s.includes("zoology")) result.add("Biology");
  if (s.includes("pcm")) {
    result.add("Physics");
    result.add("Chemistry");
    result.add("Mathematics");
  }
  if (s.includes("english") || s.includes("eng")) result.add("English");
  if (s.includes("hindi")) result.add("Hindi");
  if (s.includes("malayalam") || s.includes("mal")) result.add("Malayalam");
  if (s.includes("social") || s.includes("sst") || s.includes("ss")) result.add("Social Science");
  if (s.includes("arabic")) result.add("Arabic");
  if (s.includes("french")) result.add("French");
  if (s.includes("computer") || s.includes("it elements") || s.includes("coding")) result.add("Computer Science");
  if (s.includes("sanskrit")) result.add("Sanskrit");
  if (s.includes("evs")) result.add("EVS");
  if (s.includes("all subject") || s.includes("total")) {
    result.add("Mathematics");
    result.add("Science");
    result.add("English");
    result.add("Social Science");
  } else if (s.includes("science") && !result.has("Physics") && !result.has("Chemistry") && !result.has("Biology")) {
    result.add("Science");
  }

  if (result.size === 0) {
    result.add("General Tuition");
  }
  return Array.from(result);
}

const TRAINER_MAPPING: Record<string, string> = {
  "vafa pv": "Vafa Pv",
  "vafa": "Vafa Pv",
  "nihal moidhin": "Nihal Moideen CTP",
  "nihal": "Nihal Moideen CTP",
  "asma": "Asma M",
  "ranjitha": "Ranjitha c",
  "maha": "Maha SulaimaN",
  "nithin": "Nithin Kumar Rai R",
  "neha": "Neha Nazeer",
  "shilpa": "Shilpa Krishnan",
  "ashna": "Ashna Rajeevan",
  "thabsheera": "Thabsheera Shery P",
  "thansheera": "Thabsheera Shery P",
  "aysha finu": "Ayisha finu",
  "ayisha finu": "Ayisha finu",
  "aysha": "Ayisha finu",
  "aysha minha": "Aysha minha",
  "nawar": "Nawar",
  "shaharah": "Fathimathu Shahara",
  "shahara": "Fathimathu Shahara",
  "ihsan": "IHSAN KC",
  "shameema": "Shameema P",
  "farhana sherin": "Farhana Sherin",
  "ifna": "Fathima Ifna",
  "aswathi b": "ASWATHI B",
  "aswathy": "Aswathy.A",
  "fidha": "Fathima fidha c",
  "aswani": "Aswani P",
  "anjana": "ANJANA A",
  "vipanya": "Vipanya k",
  "jasna": "Jasna vallanchira",
  "riswana": "Riswana Narkkees S",
  "mariya": "MARIYA BENNY K",
  "maria": "MARIYA BENNY K",
  "sreelakshmi": "Sreelakshmi KS",
  "sneha": "SNEHA S NAIR",
  "sandra": "Sandra vp",
  "nikita": "Nikita",
  "febin": "Fathima Febi E",
  "ramseena": "Ramseena",
  "samvritha": "SAMVRIDHA SUNIL",
  "adithya": "Adithya",
  "shahana": "SHAHANA PARVEEN",
  "gayatri": "Gayatri Mukhi",
  "nishana": "Nishana K L",
  "ibrahim": "Munawar Ibrahim",
  "abdullah": "Abdulla zainadeen",
};

export async function importAllStudents() {
  console.log("🚀 Starting comprehensive student import...");

  // Clean up any existing students first to ensure clean import
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
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceInstalment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.parentConcern.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.studentProgress.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.admissionDraft.deleteMany();
  await prisma.student.deleteMany();
  await prisma.guardian.deleteMany();

  // 1. Ensure all standard subjects exist
  const SUBJECT_DEFS = [
    { id: "sub-math", name: "Mathematics", code: "MATH", category: "STEM", color: "#7c3aed" },
    { id: "sub-sci", name: "Science", code: "SCI", category: "Science", color: "#06b6d4" },
    { id: "sub-phy", name: "Physics", code: "PHY", category: "Science", color: "#ea580c" },
    { id: "sub-chem", name: "Chemistry", code: "CHEM", category: "Science", color: "#0284c7" },
    { id: "sub-bio", name: "Biology", code: "BIO", category: "Science", color: "#059669" },
    { id: "sub-eng", name: "English", code: "ENG", category: "Languages & Literature", color: "#16a34a" },
    { id: "sub-hin", name: "Hindi", code: "HIN", category: "Languages & Literature", color: "#e11d48" },
    { id: "sub-mal", name: "Malayalam", code: "MAL", category: "Languages & Literature", color: "#d97706" },
    { id: "sub-soc", name: "Social Science", code: "SOC", category: "Social Studies", color: "#8b5cf6" },
    { id: "sub-ara", name: "Arabic", code: "ARA", category: "Languages & Literature", color: "#0d9488" },
    { id: "sub-fre", name: "French", code: "FRE", category: "Languages & Literature", color: "#3b82f6" },
    { id: "sub-cs", name: "Computer Science", code: "CS", category: "STEM", color: "#6366f1" },
    { id: "sub-san", name: "Sanskrit", code: "SAN", category: "Languages & Literature", color: "#f59e0b" },
    { id: "sub-evs", name: "EVS", code: "EVS", category: "Science", color: "#10b981" },
    { id: "sub-gen", name: "General Tuition", code: "GEN", category: "Academic", color: "#14b8a6" },
  ];

  for (const s of SUBJECT_DEFS) {
    await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, category: s.category, color: s.color },
      create: s,
    });
  }

  // Pre-load all subjects and teachers
  const allSubjects = await prisma.subject.findMany();
  const subjectMap = new Map(allSubjects.map((s) => [s.name.toLowerCase(), s]));

  const allTeachers = await prisma.teacher.findMany();
  const teacherMap = new Map(allTeachers.map((t) => [t.name.toLowerCase(), t]));

  // Standard rates JSON
  const standardGradeRates = JSON.stringify({
    PRIMARY: 150,
    MIDDLE: 150,
    SECONDARY: 150,
    TENTH: 150,
    PLUS_ONE: 200,
    PLUS_TWO: 200,
  });

  // Helper to resolve or create teacher
  async function resolveTeacher(rawName: string): Promise<string | null> {
    if (!rawName || rawName.toLowerCase() === "none") return null;
    const clean = rawName.split(/[,&/]/)[0].trim().toLowerCase();
    const mapped = TRAINER_MAPPING[clean] || clean;

    for (const [tName, teacher] of teacherMap.entries()) {
      if (tName === mapped.toLowerCase() || tName.includes(mapped.toLowerCase()) || mapped.toLowerCase().includes(tName)) {
        return teacher.id;
      }
    }

    // Create trainer if not found
    const displayName = rawName.trim().replace(/\b\w/g, (c) => c.toUpperCase());
    const slug = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
    try {
      const created = await prisma.teacher.create({
        data: {
          name: displayName,
          email: `${slug}@xellotuition.com`,
          phone: "+91 94471 00000",
          subjects: "General",
          grades: "KG to 12th",
          defaultRate: 150,
          gradeRates: standardGradeRates,
          active: true,
        },
      });
      teacherMap.set(created.name.toLowerCase(), created);
      return created.id;
    } catch {
      return null;
    }
  }

  // Parse lines
  const lines = RAW_TSV.trim().split("\n");
  const dataRows = lines.slice(1);
  console.log(`📋 Found ${dataRows.length} student rows to import.`);

  let importedCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const parts = dataRows[i].split("\t");
    const name = parts[0]?.trim();
    if (!name) continue;

    const rawPhone = parts[1]?.trim() || "";
    const place = parts[2]?.trim() || "";
    const rawClass = parts[3]?.trim() || "";
    const syllabus = parts[4]?.trim() || "CBSE";
    const days = parts[5]?.trim() || "";
    const time = parts[6]?.trim() || "";
    const rawAmount = parts[7]?.trim() || "";
    const rawPkg = parts[8]?.trim() || "";
    const rawDate = parts[9]?.trim() || "";
    const rawSubjects = parts[10]?.trim() || "";
    const parentName = parts[11]?.trim() || "";
    const parentPhone = parts[12]?.trim() || "";
    const trainerName = parts[13]?.trim() || "";

    const { country, timeZone } = detectCountryAndTimezone(place, rawPhone);
    const grade = normalizeGrade(rawClass);
    const phone = cleanPhone(rawPhone, country);
    const startDate = parseStartDate(rawDate);
    const credits = parsePackageCredits(rawPkg, days);
    const { amount, currency } = parseAmount(rawAmount, country, credits);
    const subjectList = parseSubjects(rawSubjects);
    const assignedTeacherId = await resolveTeacher(trainerName);

    const studentCode = `XST-${String(i + 1).padStart(3, "0")}`;

    // Preferred Timings string
    const preferredTimings = [
      days ? `Days: ${days}` : null,
      time ? `Time: ${time} (IST)` : null,
      place ? `Place: ${place}` : null,
    ].filter(Boolean).join(" | ");

    // Coordinator notes
    const coordinatorNotes = [
      `Place: ${place || "Not specified"}`,
      `Original Class/Syllabus: ${rawClass} (${syllabus})`,
      `Days Selected: ${days || "Flexible"}`,
      `Preferred Time (IST): ${time || "Not specified"}`,
      `Amount Paid: ${rawAmount || "Default"}`,
      `Package Detail: ${rawPkg || `${credits} credits`}`,
      `Starting Date: ${rawDate || "April 2026"}`,
      trainerName ? `Demo Converted Trainer: ${trainerName}` : null,
      rawPhone.includes("/") || rawPhone.includes(",") ? `All Contact Numbers: ${rawPhone}` : null,
    ].filter(Boolean).join("\n");

    const guardianName = parentName || `Parent of ${name}`;
    const guardianPhone = parentPhone ? cleanPhone(parentPhone, country) : phone;

    // 1. Create Guardian if provided or linked
    const guardian = await prisma.guardian.create({
      data: {
        name: guardianName,
        whatsappNumber: guardianPhone,
        country,
        timeZone,
      },
    });

    // 2. Create Student
    const student = await prisma.student.create({
      data: {
        studentCode,
        name,
        grade,
        board: syllabus || "CBSE",
        medium: "English",
        guardianId: guardian.id,
        guardianName: guardian.name,
        whatsappNumber: phone,
        country,
        timeZone,
        joiningDate: startDate,
        preferredTimings,
        coordinatorNotes,
        status: "ACTIVE",
      },
    });

    // 3. Create Package
    const pkg = await prisma.studentPackage.create({
      data: {
        packageNumber: `PKG-${studentCode}`,
        studentId: student.id,
        name: rawPkg ? `${rawPkg.trim()} (${credits} hrs)` : `Tuition Package (${credits} hrs)`,
        totalCredits: credits,
        durationMinutes: 60,
        price: amount,
        currency,
        status: "ACTIVE",
        notes: `Starting date: ${rawDate || "April 2026"}, Schedule: ${days} ${time}`,
      },
    });

    // 4. Enroll in Subjects
    for (const subName of subjectList) {
      const subject = subjectMap.get(subName.toLowerCase()) || subjectMap.get("general tuition")!;
      await prisma.subjectEnrollment.create({
        data: {
          studentId: student.id,
          subjectId: subject.id,
          teacherId: assignedTeacherId,
          status: "ACTIVE",
        },
      });
    }

    // 5. Create Invoice & Verified Payment record
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${studentCode}`,
        studentId: student.id,
        packageId: pkg.id,
        issueDate: startDate,
        dueDate: startDate,
        subtotal: amount,
        totalAmount: amount,
        paidAmount: amount,
        balanceDue: 0,
        currency,
        status: "PAID",
        notes: `Paid via Demo Admission: ${rawAmount || `₹${amount}`}`,
      },
    });

    const payment = await prisma.payment.create({
      data: {
        paymentNumber: `PAY-${studentCode}`,
        studentId: student.id,
        amount,
        currency,
        receivedDate: startDate,
        paymentMethod: "BANK_TRANSFER",
        reference: `DEMO-CONV-${studentCode}`,
        isVerified: true,
        verifiedAt: startDate,
        verifiedByName: "Admin",
        verifiedByRole: "OWNER",
        notes: `Payment for ${pkg.name}`,
      },
    });

    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount,
      },
    });

    importedCount++;
  }

  console.log(`✅ Successfully imported all ${importedCount} students with full profiles, packages, and invoices!`);
}

async function main() {
  await importAllStudents();
}

main()
  .catch((e) => {
    console.error("❌ Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
