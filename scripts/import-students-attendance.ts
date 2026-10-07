import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface StudentInput {
  sl: number;
  name: string;
  pkg: number | null;
  att: number;
}

const RAW_STUDENTS: StudentInput[] = [
  { sl: 1, name: "Rithik p", pkg: 12, att: 12 },
  { sl: 2, name: "Aiden Dinny", pkg: 40, att: 41 },
  { sl: 3, name: "Devna jayesh", pkg: 44, att: 55 },
  { sl: 4, name: "ALAN SHAIJU", pkg: null, att: 28 },
  { sl: 5, name: "Neda Jamal", pkg: null, att: 18 },
  { sl: 6, name: "Muhammed Farhan", pkg: null, att: 41 },
  { sl: 7, name: "Angela Elsa Renju", pkg: null, att: 24 },
  { sl: 8, name: "Anugraha Umesh C", pkg: null, att: 15 },
  { sl: 9, name: "AADINATH S", pkg: null, att: 33 },
  { sl: 10, name: "Fathima A shakeer", pkg: null, att: 21 },
  { sl: 11, name: "Angelina Sara Tiju", pkg: null, att: 79 },
  { sl: 12, name: "Aviah", pkg: null, att: 73 },
  { sl: 13, name: "Ziya Abinawas", pkg: null, att: 40 },
  { sl: 14, name: "Nabhan", pkg: null, att: 73 },
  { sl: 15, name: "Zahil Abinavas", pkg: null, att: 36 },
  { sl: 16, name: "Ayan Anees", pkg: null, att: 51 },
  { sl: 17, name: "Lazhar kamal", pkg: null, att: 19 },
  { sl: 18, name: "Mifzal rahan", pkg: null, att: 48 },
  { sl: 19, name: "Mayookha Prabhu", pkg: null, att: 89 },
  { sl: 20, name: "Salih Mohamed (maths)", pkg: null, att: 18 },
  { sl: 21, name: "Prakriti prajin", pkg: null, att: 10 },
  { sl: 22, name: "Aganaya Sreejith", pkg: null, att: 65 },
  { sl: 23, name: "Ehaan Anees", pkg: null, att: 55 },
  { sl: 24, name: "Saarang Arjun", pkg: null, att: 20 },
  { sl: 25, name: "Muhammad hamdan kasim", pkg: null, att: 13 },
  { sl: 26, name: "Krithik. C Krishnan", pkg: null, att: 127 },
  { sl: 27, name: "Siona Sajeesh", pkg: null, att: 6 },
  { sl: 28, name: "Zain Sajeesh", pkg: null, att: 8 },
  { sl: 29, name: "Rihan Bin Rafeek", pkg: null, att: 4 },
  { sl: 30, name: "RYAN MELVIN FERNANDEZ", pkg: null, att: 35 },
  { sl: 31, name: "Anwita Abhilash", pkg: null, att: 86 },
  { sl: 32, name: "Diya Harikumar D", pkg: null, att: 64 },
  { sl: 33, name: "Adline Mariyam Sam", pkg: null, att: 60 },
  { sl: 34, name: "Asthik manesh", pkg: null, att: 39 },
  { sl: 35, name: "Tanve C Vijith", pkg: null, att: 40 },
  { sl: 36, name: "ARUNDHATHI R NAIR", pkg: null, att: 71 },
  { sl: 37, name: "Reathaj", pkg: null, att: 6 },
  { sl: 38, name: "Alicia Sara Shiju", pkg: null, att: 25 },
  { sl: 39, name: "Anshif M", pkg: null, att: 32 },
  { sl: 40, name: "Evelyn elza George", pkg: null, att: 4 },
  { sl: 41, name: "Nainika Sreejith", pkg: null, att: 12 },
  { sl: 42, name: "Eeva Izza Fathima", pkg: null, att: 38 },
  { sl: 43, name: "Alan Robin", pkg: null, att: 19 },
  { sl: 44, name: "Ashley JACOB", pkg: null, att: 9 },
  { sl: 45, name: "Angeline linto", pkg: null, att: 53 },
  { sl: 46, name: "Hazim Ahamed", pkg: null, att: 9 },
  { sl: 47, name: "Alan sajo", pkg: null, att: 44 },
  { sl: 48, name: "RiyanRejish", pkg: 40, att: 40 },
  { sl: 49, name: "Jude Mathews", pkg: null, att: 58 },
  { sl: 50, name: "Karthikeyan D", pkg: null, att: 71 },
  { sl: 51, name: "Brindha. R", pkg: null, att: 20 },
  { sl: 52, name: "Crystal Mary Roy", pkg: null, att: 9 },
  { sl: 53, name: "Abdulla zainadeen", pkg: null, att: 15 },
  { sl: 54, name: "Reeshah Haleem", pkg: null, att: 60 },
  { sl: 55, name: "Munawar Ibrahim", pkg: null, att: 11 },
  { sl: 56, name: "ABHIRAM ASHOK", pkg: null, att: 19 },
  { sl: 57, name: "Faiza", pkg: null, att: 41 },
  { sl: 58, name: "Jenn Riya Sam", pkg: null, att: 22 },
  { sl: 59, name: "Mohammed yaseen", pkg: null, att: 103 },
  { sl: 60, name: "Jewel Elizabeth Cyriac", pkg: null, att: 40 },
  { sl: 61, name: "Erin Jinu George", pkg: null, att: 18 },
  { sl: 62, name: "SHRUTI POLIN JONES", pkg: null, att: 16 },
  { sl: 63, name: "RAIBAL JIYO", pkg: null, att: 12 },
  { sl: 64, name: "Hanna Shanavas", pkg: null, att: 45 },
  { sl: 65, name: "Muhammed Shebin P", pkg: null, att: 34 },
  { sl: 66, name: "MYSHA AIYAS AGA", pkg: null, att: 36 },
  { sl: 67, name: "Liam Ahamed", pkg: null, att: 7 },
  { sl: 68, name: "Ritvika Vipinkumar", pkg: null, att: 24 },
  { sl: 69, name: "Vagisha Varun Nair", pkg: null, att: 36 },
  { sl: 70, name: "Saatvik Arjun", pkg: null, att: 34 },
  { sl: 71, name: "Joel Antony Alfred", pkg: null, att: 14 },
  { sl: 72, name: "Abdullah Bin Abu Thahir", pkg: 48, att: 48 },
  { sl: 73, name: "ANLIYA MS", pkg: null, att: 45 },
  { sl: 74, name: "Vishnu S Viswanath", pkg: null, att: 22 },
  { sl: 75, name: "Rihan Subair", pkg: null, att: 7 },
  { sl: 76, name: "Nehal Vimal Dev", pkg: null, att: 37 },
  { sl: 77, name: "NS Karthik", pkg: null, att: 28.5 },
  { sl: 78, name: "Aptha Ratheesh", pkg: null, att: 37 },
  { sl: 79, name: "Fathima Anjoom", pkg: null, att: 31 },
  { sl: 80, name: "Mohammad hanan. V", pkg: null, att: 18 },
  { sl: 81, name: "Fathima aina. V", pkg: null, att: 21 },
  { sl: 82, name: "Siya Fathima Sanis", pkg: null, att: 21 },
  { sl: 83, name: "Rayan Shamseer", pkg: null, att: 16 },
  { sl: 84, name: "Zainab Shamseer", pkg: null, att: 18.5 },
  { sl: 85, name: "Adhrit poonoth", pkg: null, att: 16 },
  { sl: 86, name: "Rahul B Mohan", pkg: null, att: 13 },
  { sl: 87, name: "Aafreen Fathima", pkg: null, att: 27 },
  { sl: 88, name: "Alna Theresa Vibin", pkg: null, att: 10 },
  { sl: 89, name: "EBIN SEBASTIAN", pkg: null, att: 23 },
  { sl: 90, name: "Adwika Deepu", pkg: null, att: 23 },
  { sl: 91, name: "Sayyid Ahmad Fazal", pkg: null, att: 16 },
  { sl: 92, name: "Janoah Varghese Tinu", pkg: null, att: 17 },
  { sl: 93, name: "Ayisha Ezrin", pkg: null, att: 11 },
  { sl: 94, name: "Sara susan ronny", pkg: null, att: 7 },
  { sl: 95, name: "Azza Mehak A. A", pkg: null, att: 6 },
  { sl: 96, name: "Maryam Nizam arabic", pkg: null, att: 8 },
  { sl: 97, name: "Joseph George kottayil", pkg: null, att: 7 },
  { sl: 98, name: "Yara Zainab", pkg: null, att: 6 },
  { sl: 99, name: "Maryam", pkg: null, att: 8 },
  { sl: 100, name: "Adharv Sony", pkg: null, att: 7 },
  { sl: 101, name: "Delna Vinu", pkg: null, att: 5.5 },
  { sl: 102, name: "Anand krishna.p", pkg: null, att: 12 },
  { sl: 103, name: "Josh N Nidhiry", pkg: null, att: 7 },
  { sl: 104, name: "AADHISANKAR", pkg: null, att: 7 },
  { sl: 105, name: "ANVITHA SARATH", pkg: null, att: 4 },
  { sl: 106, name: "Sainika Ragupathy", pkg: null, att: 0 },
  { sl: 107, name: "Ayisha", pkg: null, att: 0 },
  { sl: 108, name: "Neha. T", pkg: null, att: 11 },
  { sl: 109, name: "Tanvika Vipin", pkg: null, att: 9 },
  { sl: 110, name: "Ishaan R Kumar", pkg: null, att: 2 },
  { sl: 111, name: "vishnu dev.m", pkg: null, att: 7 },
  { sl: 112, name: "Karthik jayesh", pkg: null, att: 6 },
  { sl: 113, name: "DANIEL JACOB JOY", pkg: null, att: 2 },
  { sl: 114, name: "Aiden Thomas Manu", pkg: null, att: 5 },
  { sl: 115, name: "MUHAMMED ISMAIL", pkg: null, att: 3 },
  { sl: 116, name: "Catherine Pratheesh", pkg: null, att: 2 },
  { sl: 117, name: "Jaslyn Rathna", pkg: null, att: 0 },
  { sl: 118, name: "Saketh Sanal", pkg: null, att: 3.5 },
  { sl: 119, name: "Catherine Maria Benny", pkg: null, att: 0 },
  { sl: 120, name: "Ann Anna Paul", pkg: null, att: 8 },
  { sl: 121, name: "Dharmika SA", pkg: null, att: 0 },
  { sl: 122, name: "Mikha Maria Sibi", pkg: null, att: 0 },
  { sl: 123, name: "Richard mahesh george", pkg: null, att: 3 },
  { sl: 124, name: "Muhammed Thameem", pkg: null, att: 1 },
  { sl: 125, name: "Adrika Deepu", pkg: null, att: 0 },
  { sl: 126, name: "Eshan", pkg: null, att: 0 },
  { sl: 127, name: "Ayden Stephen", pkg: null, att: 0 },
  { sl: 128, name: "Mohammed Jahiz", pkg: null, att: 0 },
  { sl: 129, name: "aviah (phy,chem,hindi)", pkg: null, att: 4 },
];

async function main() {
  console.log(`🚀 Starting student import (${RAW_STUDENTS.length} students)...`);

  // Ensure base subject exists
  let defaultSubject = await prisma.subject.findFirst();
  if (!defaultSubject) {
    defaultSubject = await prisma.subject.create({
      data: {
        id: "sub-gen",
        name: "General Tuition",
        code: "GEN",
        category: "Academic",
        color: "#14b8a6",
      },
    });
  }

  // Ensure at least one teacher exists
  let defaultTeacher = await prisma.teacher.findFirst();
  if (!defaultTeacher) {
    defaultTeacher = await prisma.teacher.create({
      data: {
        id: "tch-default",
        name: "Faculty Coordinator",
        email: "faculty@xellotuition.com",
        phone: "+91 94471 88201",
        subjects: "General",
        grades: "1st to 12th",
      },
    });
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of RAW_STUDENTS) {
    const studentCode = `XST-SEED-${String(item.sl).padStart(3, "0")}`;

    // Calculate totalCredits for package
    let totalCredits = item.pkg;
    if (!totalCredits || totalCredits <= 0) {
      totalCredits = item.att > 0 ? Math.max(Math.ceil(item.att), 12) : 12;
    }

    // 1. Upsert Student
    const student = await prisma.student.upsert({
      where: { studentCode },
      update: {
        name: item.name.trim(),
      },
      create: {
        studentCode,
        name: item.name.trim(),
        grade: "10th Grade",
        board: "CBSE",
        medium: "English",
        guardianName: `Parent / Guardian of ${item.name.trim()}`,
        whatsappNumber: "+91 90000 00000",
        country: "India",
        timeZone: "Asia/Kolkata",
        status: "ACTIVE",
      },
    });

    // 2. Ensure Subject Enrollment
    await prisma.subjectEnrollment.upsert({
      where: {
        studentId_subjectId: {
          studentId: student.id,
          subjectId: defaultSubject.id,
        },
      },
      update: {},
      create: {
        studentId: student.id,
        subjectId: defaultSubject.id,
        teacherId: defaultTeacher.id,
        status: "ACTIVE",
      },
    });

    // 3. Ensure Active Package
    const existingPackage = await prisma.studentPackage.findFirst({
      where: { studentId: student.id, status: "ACTIVE" },
      include: { sessions: true },
    });

    let pkg = existingPackage;
    if (!pkg) {
      const packageNumber = `PKG-${studentCode}`;
      pkg = await prisma.studentPackage.create({
        data: {
          packageNumber,
          studentId: student.id,
          name: `Tuition Package (${totalCredits} hrs)`,
          totalCredits,
          durationMinutes: 60,
          price: totalCredits * 500,
          currency: "INR",
          status: "ACTIVE",
        },
        include: { sessions: true },
      });
      createdCount++;
    } else {
      if (pkg.totalCredits !== totalCredits) {
        pkg = await prisma.studentPackage.update({
          where: { id: pkg.id },
          data: { totalCredits },
          include: { sessions: true },
        });
      }
      updatedCount++;
    }

    // 4. Create Attended Sessions
    const requiredSessionsCount = Math.ceil(item.att);
    const existingConsumedCount = pkg.sessions.filter((s) => s.isCreditConsumed).length;
    const needed = requiredSessionsCount - existingConsumedCount;

    if (needed > 0) {
      const sessionData = [];
      const now = new Date();
      for (let sIdx = 0; sIdx < needed; sIdx++) {
        // Space sessions back in time
        const sessionDate = new Date(now.getTime() - (sIdx + 1) * 24 * 3600 * 1000);
        sessionData.push({
          packageId: pkg.id,
          studentId: student.id,
          teacherId: defaultTeacher.id,
          subjectId: defaultSubject.id,
          scheduledStartTimeUtc: sessionDate,
          scheduledEndTimeUtc: new Date(sessionDate.getTime() + 60 * 60 * 1000),
          durationMinutes: 60,
          status: "COMPLETED",
          isCreditConsumed: true,
        });
      }

      await prisma.session.createMany({
        data: sessionData,
      });
    }
  }

  console.log(`✅ Successfully imported all 129 student profiles!`);
  console.log(`   - New packages created: ${createdCount}`);
  console.log(`   - Updated packages: ${updatedCount}`);
}

main()
  .catch((e) => {
    console.error("❌ Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
