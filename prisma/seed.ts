import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Xello Tuition Demo Seed...");

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

  // 2. Subjects
  const chemistry = await prisma.subject.create({
    data: {
      id: "sub-chem",
      name: "Chemistry",
      code: "CHEM",
      category: "Science",
      color: "#0284c7",
    },
  });

  const english = await prisma.subject.create({
    data: {
      id: "sub-eng",
      name: "English",
      code: "ENG",
      category: "Languages & Literature",
      color: "#16a34a",
    },
  });

  const mathematics = await prisma.subject.create({
    data: {
      id: "sub-math",
      name: "Mathematics",
      code: "MATH",
      category: "STEM",
      color: "#7c3aed",
    },
  });

  const physics = await prisma.subject.create({
    data: {
      id: "sub-phy",
      name: "Physics",
      code: "PHY",
      category: "Science",
      color: "#ea580c",
    },
  });

  const biology = await prisma.subject.create({
    data: {
      id: "sub-bio",
      name: "Biology",
      code: "BIO",
      category: "Science",
      color: "#059669",
    },
  });

  console.log("✅ Seeded 5 Subjects.");

  // 3. Teachers
  const teacherRahul = await prisma.teacher.create({
    data: {
      id: "tch-rahul",
      name: "Rahul Varma, M.Sc.",
      email: "teacher.rahul@xellotuition.com",
      phone: "+91 94471 88201",
      subjects: "Chemistry",
      grades: "10th, 11th, 12th, NEET Prep",
      country: "India",
      timeZone: "Asia/Kolkata",
      defaultRate: 600,
    },
  });

  const teacherPriya = await prisma.teacher.create({
    data: {
      id: "tch-priya",
      name: "Priya Menon, M.A. B.Ed.",
      email: "teacher.priya@xellotuition.com",
      phone: "+91 98472 44319",
      subjects: "English",
      grades: "8th, 9th, 10th, 11th, 12th, IELTS",
      country: "India",
      timeZone: "Asia/Kolkata",
      defaultRate: 550,
    },
  });

  const teacherAnand = await prisma.teacher.create({
    data: {
      id: "tch-anand",
      name: "Anand K., M.Sc.",
      email: "teacher.anand@xellotuition.com",
      phone: "+91 97450 11982",
      subjects: "Mathematics",
      grades: "9th, 10th, 11th, 12th, JEE Main",
      country: "India",
      timeZone: "Asia/Kolkata",
      defaultRate: 650,
    },
  });

  console.log("✅ Seeded 3 Teachers.");

  // 4. System Users for all 4 roles
  await prisma.user.createMany({
    data: [
      {
        id: "usr-admin",
        email: "admin@xellotuition.com",
        name: "Devanand Nambiar (Admin / Owner)",
        role: "OWNER",
      },
      {
        id: "usr-coord",
        email: "coordinator@xellotuition.com",
        name: "Aisha Nair (Academic Coordinator)",
        role: "COORDINATOR",
      },
      {
        id: "usr-rahul",
        email: "teacher.rahul@xellotuition.com",
        name: "Rahul Varma (Teacher - Chemistry)",
        role: "TEACHER",
        teacherId: teacherRahul.id,
      },
      {
        id: "usr-priya",
        email: "teacher.priya@xellotuition.com",
        name: "Priya Menon (Teacher - English)",
        role: "TEACHER",
        teacherId: teacherPriya.id,
      },
      {
        id: "usr-accounts",
        email: "accounts@xellotuition.com",
        name: "Joseph Thomas (Accounts Manager)",
        role: "ACCOUNTS",
      },
    ],
  });

  console.log("✅ Seeded 5 User Accounts across Owner, Coordinator, Teacher & Accounts.");

  // 5. Package Templates
  const template20 = await prisma.packageTemplate.create({
    data: {
      id: "tpl-20",
      name: "Standard 20-Class Multi-Subject Booster",
      totalCredits: 20,
      durationMinutes: 60,
      defaultPrice: 18000,
      currency: "INR",
      notes: "Flexible multi-subject allocation with 4-hour cancellation window",
    },
  });

  const template10 = await prisma.packageTemplate.create({
    data: {
      id: "tpl-10",
      name: "10-Class Single / Dual Subject Focus",
      totalCredits: 10,
      durationMinutes: 60,
      defaultPrice: 9500,
      currency: "INR",
      notes: "Sprint preparation package",
    },
  });

  // 6. Guardians
  const guardianChandran = await prisma.guardian.create({
    data: {
      id: "grd-chandran",
      name: "Chandrasekharan Pillai",
      whatsappNumber: "+971 50 234 5678",
      email: "chandran.p@dubaimail.ae",
      country: "UAE",
      timeZone: "Asia/Dubai",
      notes: "Senior Engineer at Dubai Maritime City, prefers WhatsApp updates after 6 PM GST",
    },
  });

  const guardianKurian = await prisma.guardian.create({
    data: {
      id: "grd-kurian",
      name: "Dr. Kurian Mathew",
      whatsappNumber: "+966 54 876 5432",
      email: "k.mathew@moh.gov.sa",
      country: "Saudi Arabia",
      timeZone: "Asia/Riyadh",
      notes: "Pediatrician in Riyadh, daughter preparing for ICSE Board Exams",
    },
  });

  const guardianMenon = await prisma.guardian.create({
    data: {
      id: "grd-menon",
      name: "Sujatha Menon",
      whatsappNumber: "+91 98471 23456",
      email: "sujatha.menon@keralatrust.org",
      country: "India",
      timeZone: "Asia/Kolkata",
      notes: "Resident of Kozhikode, son in Grade 12 Kerala State Board",
    },
  });

  // 7. Student 1: Naveen Chandran (Essential Multi-Subject Package Scenario)
  const studentNaveen = await prisma.student.create({
    data: {
      id: "stu-naveen",
      studentCode: "XEL-2026-001",
      name: "Naveen Chandran",
      grade: "11th Grade",
      board: "CBSE",
      medium: "English",
      guardianId: guardianChandran.id,
      guardianName: "Chandrasekharan Pillai",
      whatsappNumber: "+971 50 234 5678",
      email: "naveen.c2026@gmail.com",
      country: "UAE",
      timeZone: "Asia/Dubai",
      joiningDate: new Date("2026-08-01"),
      preferredTimings: "Weekdays 6:00 PM - 8:30 PM GST",
      learningGoals: "Improve Organic Chemistry fundamentals and CBSE English Class 11 writing skills",
      coordinatorNotes: "Very sincere student; exam series starts in December.",
      status: "ACTIVE",
    },
  });

  // Enrolments for Naveen
  await prisma.subjectEnrollment.createMany({
    data: [
      {
        id: "enr-nav-chem",
        studentId: studentNaveen.id,
        subjectId: chemistry.id,
        teacherId: teacherRahul.id,
        status: "ACTIVE",
        notes: "Target: CBSE Class 11 Midterms",
      },
      {
        id: "enr-nav-eng",
        studentId: studentNaveen.id,
        subjectId: english.id,
        teacherId: teacherPriya.id,
        status: "ACTIVE",
        notes: "Target: CBSE English Core",
      },
    ],
  });

  // Student 1 Package: 20 Classes (Chemistry: 10, English: 10)
  const packageNaveen = await prisma.studentPackage.create({
    data: {
      id: "pkg-nav-001",
      packageNumber: "PKG-2026-001",
      studentId: studentNaveen.id,
      templateId: template20.id,
      name: "Class 11 CBSE Multi-Subject 20-Pack",
      totalCredits: 20,
      durationMinutes: 60,
      startDate: new Date("2026-08-10"),
      expiryDate: new Date("2027-03-31"),
      price: 18000,
      currency: "INR",
      status: "ACTIVE",
      cancellationNoticeHours: 4,
      noShowDeductCredit: true,
      notes: "Initially allocated Chemistry: 10, English: 10. Shared balance model.",
    },
  });

  // Allocations: 10 Chemistry, 10 English
  await prisma.subjectAllocation.createMany({
    data: [
      {
        id: "alloc-nav-chem",
        packageId: packageNaveen.id,
        subjectId: chemistry.id,
        allocatedCredits: 10,
      },
      {
        id: "alloc-nav-eng",
        packageId: packageNaveen.id,
        subjectId: english.id,
        allocatedCredits: 10,
      },
    ],
  });

  // Initial purchase ledger entry
  await prisma.creditLedger.createMany({
    data: [
      {
        packageId: packageNaveen.id,
        subjectId: chemistry.id,
        eventType: "PURCHASE_INITIAL",
        creditsDelta: 10,
        resultingRemaining: 10,
        reason: "Initial package purchase allocation",
        actorRole: "ACCOUNTS",
        actorName: "Joseph Thomas",
      },
      {
        packageId: packageNaveen.id,
        subjectId: english.id,
        eventType: "PURCHASE_INITIAL",
        creditsDelta: 10,
        resultingRemaining: 10,
        reason: "Initial package purchase allocation",
        actorRole: "ACCOUNTS",
        actorName: "Joseph Thomas",
      },
    ],
  });

  // Now create the EXACT historical scenario:
  // Complete 6 Chemistry classes and 4 English classes!
  console.log("📝 Generating 6 completed Chemistry and 4 completed English sessions for Naveen...");

  for (let i = 1; i <= 6; i++) {
    const sessionDate = new Date(`2026-09-0${i}T14:30:00Z`); // 18:30 GST (14:30 UTC)
    const endDate = new Date(sessionDate.getTime() + 60 * 60 * 1000);
    const session = await prisma.session.create({
      data: {
        id: `ses-nav-chem-${i}`,
        packageId: packageNaveen.id,
        studentId: studentNaveen.id,
        teacherId: teacherRahul.id,
        subjectId: chemistry.id,
        scheduledStartTimeUtc: sessionDate,
        scheduledEndTimeUtc: endDate,
        durationMinutes: 60,
        status: "COMPLETED",
        meetingUrl: "https://meet.google.com/xel-chem-nav",
        isCreditReserved: false,
        isCreditConsumed: true,
      },
    });

    await prisma.attendanceRecord.create({
      data: {
        sessionId: session.id,
        sessionOutcome: "COMPLETED",
        studentAttendance: "PRESENT",
        actualDurationMinutes: 60,
        topicCovered: `Organic Chemistry - Chapter ${i}: Hydrocarbons & Reaction Mechanisms Part ${i}`,
        homework: "Solve NCERT exercise questions 1 to 15",
        studentProgressNote: "Good understanding of electron displacement effects.",
        markedByRole: "TEACHER",
        markedByName: "Rahul Varma, M.Sc.",
        markedAt: endDate,
      },
    });

    await prisma.creditLedger.create({
      data: {
        packageId: packageNaveen.id,
        subjectId: chemistry.id,
        eventType: "SESSION_CONSUMED",
        creditsDelta: -1,
        resultingRemaining: 10 - i,
        sessionId: session.id,
        reason: `Class delivered: Chapter ${i} Hydrocarbons`,
        actorRole: "TEACHER",
        actorName: "Rahul Varma, M.Sc.",
      },
    });

    // Payout item for teacher
    await prisma.payoutItem.create({
      data: {
        id: `poi-chem-${i}`,
        teacherId: teacherRahul.id,
        sessionId: session.id,
        sessionDate,
        durationMinutes: 60,
        rateSnapshot: 600,
        amount: 600,
        status: "APPROVED",
        notes: "Verified completed one-to-one chemistry session",
      },
    });
  }

  for (let i = 1; i <= 4; i++) {
    const sessionDate = new Date(`2026-09-1${i}T15:00:00Z`); // 19:00 GST (15:00 UTC)
    const endDate = new Date(sessionDate.getTime() + 60 * 60 * 1000);
    const session = await prisma.session.create({
      data: {
        id: `ses-nav-eng-${i}`,
        packageId: packageNaveen.id,
        studentId: studentNaveen.id,
        teacherId: teacherPriya.id,
        subjectId: english.id,
        scheduledStartTimeUtc: sessionDate,
        scheduledEndTimeUtc: endDate,
        durationMinutes: 60,
        status: "COMPLETED",
        meetingUrl: "https://meet.google.com/xel-eng-nav",
        isCreditReserved: false,
        isCreditConsumed: true,
      },
    });

    await prisma.attendanceRecord.create({
      data: {
        sessionId: session.id,
        sessionOutcome: "COMPLETED",
        studentAttendance: "PRESENT",
        actualDurationMinutes: 60,
        topicCovered: `English Core - Formal Letters, Debate & Hornbill Analysis Session ${i}`,
        homework: "Draft 200-word debate speech for evaluation",
        studentProgressNote: "Excellent vocabulary and grammatical structure.",
        markedByRole: "TEACHER",
        markedByName: "Priya Menon, M.A. B.Ed.",
        markedAt: endDate,
      },
    });

    await prisma.creditLedger.create({
      data: {
        packageId: packageNaveen.id,
        subjectId: english.id,
        eventType: "SESSION_CONSUMED",
        creditsDelta: -1,
        resultingRemaining: 10 - i,
        sessionId: session.id,
        reason: `Class delivered: English Core Session ${i}`,
        actorRole: "TEACHER",
        actorName: "Priya Menon, M.A. B.Ed.",
      },
    });

    await prisma.payoutItem.create({
      data: {
        id: `poi-eng-${i}`,
        teacherId: teacherPriya.id,
        sessionId: session.id,
        sessionDate,
        durationMinutes: 60,
        rateSnapshot: 550,
        amount: 550,
        status: "APPROVED",
        notes: "Verified completed one-to-one English session",
      },
    });
  }

  // Future scheduled sessions for Naveen (1 Chemistry, 1 English reserved)
  const tomorrowChem = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrowChem.setUTCHours(14, 30, 0, 0);
  await prisma.session.create({
    data: {
      id: "ses-nav-chem-upcoming",
      packageId: packageNaveen.id,
      studentId: studentNaveen.id,
      teacherId: teacherRahul.id,
      subjectId: chemistry.id,
      scheduledStartTimeUtc: tomorrowChem,
      scheduledEndTimeUtc: new Date(tomorrowChem.getTime() + 60 * 60 * 1000),
      durationMinutes: 60,
      status: "SCHEDULED",
      meetingUrl: "https://meet.google.com/xel-chem-nav",
      isCreditReserved: true,
      isCreditConsumed: false,
    },
  });

  const nextWeekEng = new Date(Date.now() + 48 * 60 * 60 * 1000);
  nextWeekEng.setUTCHours(15, 0, 0, 0);
  await prisma.session.create({
    data: {
      id: "ses-nav-eng-upcoming",
      packageId: packageNaveen.id,
      studentId: studentNaveen.id,
      teacherId: teacherPriya.id,
      subjectId: english.id,
      scheduledStartTimeUtc: nextWeekEng,
      scheduledEndTimeUtc: new Date(nextWeekEng.getTime() + 60 * 60 * 1000),
      durationMinutes: 60,
      status: "SCHEDULED",
      meetingUrl: "https://meet.google.com/xel-eng-nav",
      isCreditReserved: true,
      isCreditConsumed: false,
    },
  });

  // Invoice & Payment for Naveen: ₹18,000 package, ₹12,000 paid, ₹6,000 balance due
  const invNaveen = await prisma.invoice.create({
    data: {
      id: "inv-nav-001",
      invoiceNumber: "INV-2026-001",
      studentId: studentNaveen.id,
      packageId: packageNaveen.id,
      issueDate: new Date("2026-08-10"),
      dueDate: new Date("2026-08-25"),
      subtotal: 18000,
      discount: 0,
      totalAmount: 18000,
      paidAmount: 12000,
      balanceDue: 6000,
      currency: "INR",
      status: "PARTIALLY_PAID",
      notes: "Two-instalment plan (₹12,000 paid advance, ₹6,000 midterm balance)",
    },
  });

  await prisma.invoiceLineItem.create({
    data: {
      invoiceId: invNaveen.id,
      description: "20-Class Multi-Subject Personalized Package (Chemistry & English)",
      quantity: 1,
      unitPrice: 18000,
      amount: 18000,
    },
  });

  const payNaveen = await prisma.payment.create({
    data: {
      id: "pay-nav-001",
      paymentNumber: "PAY-2026-001",
      studentId: studentNaveen.id,
      amount: 12000,
      currency: "INR",
      receivedDate: new Date("2026-08-10"),
      paymentMethod: "BANK_TRANSFER",
      reference: "HDFC-NEFT-99281741",
      proofFileName: "naveen_advance_receipt.pdf",
      proofUrl: "/proofs/sample_transfer_receipt.pdf",
      isVerified: true,
      verifiedAt: new Date("2026-08-11"),
      verifiedByName: "Joseph Thomas",
      verifiedByRole: "ACCOUNTS",
      notes: "Verified against HDFC Current Account statement",
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: payNaveen.id,
      invoiceId: invNaveen.id,
      amount: 12000,
    },
  });

  // Student 2: Ananya Kurian (Riyadh, Saudi Arabia)
  const studentAnanya = await prisma.student.create({
    data: {
      id: "stu-ananya",
      studentCode: "XEL-2026-002",
      name: "Ananya Kurian",
      grade: "10th Grade",
      board: "ICSE",
      medium: "English",
      guardianId: guardianKurian.id,
      guardianName: "Dr. Kurian Mathew",
      whatsappNumber: "+966 54 876 5432",
      email: "ananya.kurian@gmail.com",
      country: "Saudi Arabia",
      timeZone: "Asia/Riyadh",
      joiningDate: new Date("2026-09-01"),
      preferredTimings: "Fridays & Saturdays 10:00 AM - 1:00 PM AST",
      learningGoals: "ICSE Class 10 Board Exam preparation for Mathematics & Physics",
      coordinatorNotes: "Focus on trigonometry and mechanics.",
      status: "ACTIVE",
    },
  });

  const pkgAnanya = await prisma.studentPackage.create({
    data: {
      id: "pkg-ana-001",
      packageNumber: "PKG-2026-002",
      studentId: studentAnanya.id,
      templateId: template20.id,
      name: "ICSE Class 10 Math & Physics 16-Pack",
      totalCredits: 16,
      durationMinutes: 60,
      startDate: new Date("2026-09-01"),
      expiryDate: new Date("2027-02-28"),
      price: 15000,
      currency: "INR",
      status: "ACTIVE",
      cancellationNoticeHours: 4,
      noShowDeductCredit: true,
    },
  });

  await prisma.subjectAllocation.createMany({
    data: [
      {
        packageId: pkgAnanya.id,
        subjectId: mathematics.id,
        allocatedCredits: 10,
      },
      {
        packageId: pkgAnanya.id,
        subjectId: physics.id,
        allocatedCredits: 6,
      },
    ],
  });

  // Unverified payment proof scenario for Ananya
  await prisma.payment.create({
    data: {
      id: "pay-ana-proof-unverified",
      paymentNumber: "PAY-2026-002",
      studentId: studentAnanya.id,
      amount: 15000,
      currency: "INR",
      receivedDate: new Date(),
      paymentMethod: "BANK_TRANSFER",
      reference: "SNB-KSA-TRANSFER-49821",
      proofFileName: "riyadh_bank_transfer_slip.jpg",
      proofUrl: "/proofs/riyadh_slip.jpg",
      isVerified: false, // Proof uploaded, NOT yet verified by Accounts!
      notes: "Proof uploaded by parent via WhatsApp; awaiting clearance in ICICI bank statement",
    },
  });

  // Student 3: Adithya Menon (Kerala, India) - Overdue scenario & low balance
  const studentAdithya = await prisma.student.create({
    data: {
      id: "stu-adithya",
      studentCode: "XEL-2026-003",
      name: "Adithya Menon",
      grade: "12th Grade",
      board: "Kerala State",
      medium: "English",
      guardianId: guardianMenon.id,
      guardianName: "Sujatha Menon",
      whatsappNumber: "+91 98471 23456",
      email: "adithya.menon@gmail.com",
      country: "India",
      timeZone: "Asia/Kolkata",
      joiningDate: new Date("2026-07-15"),
      preferredTimings: "Daily 7:00 PM - 8:30 PM IST",
      learningGoals: "Biology Class 12 Botany & Zoology Revision",
      status: "ACTIVE",
    },
  });

  const pkgAdithya = await prisma.studentPackage.create({
    data: {
      id: "pkg-adi-001",
      packageNumber: "PKG-2026-003",
      studentId: studentAdithya.id,
      templateId: template10.id,
      name: "Biology 10-Class Crash Sprint",
      totalCredits: 10,
      durationMinutes: 60,
      startDate: new Date("2026-07-20"),
      expiryDate: new Date("2026-10-31"),
      price: 9000,
      currency: "INR",
      status: "ACTIVE",
    },
  });

  await prisma.subjectAllocation.create({
    data: {
      packageId: pkgAdithya.id,
      subjectId: biology.id,
      allocatedCredits: 10,
    },
  });

  // Overdue invoice for Adithya
  const overdueInvoice = await prisma.invoice.create({
    data: {
      id: "inv-adi-001",
      invoiceNumber: "INV-2026-002",
      studentId: studentAdithya.id,
      packageId: pkgAdithya.id,
      issueDate: new Date("2026-09-15"),
      dueDate: new Date("2026-09-28"), // 8 days overdue!
      subtotal: 9000,
      discount: 0,
      totalAmount: 9000,
      paidAmount: 3000,
      balanceDue: 6000,
      currency: "INR",
      status: "OVERDUE",
      notes: "Second instalment of ₹6,000 overdue past September 28",
    },
  });

  // Follow-up entry in the work queue
  await prisma.followUp.create({
    data: {
      id: "fol-adi-001",
      studentId: studentAdithya.id,
      invoiceId: overdueInvoice.id,
      type: "OVERDUE_PAYMENT",
      assignedStaff: "Joseph Thomas",
      contactDate: new Date("2026-10-02"),
      outcome: "PROMISED_PAYMENT",
      parentResponse: "Mother said father is transferring funds from Muscat this weekend.",
      promisedPaymentDate: new Date("2026-10-10"),
      nextActionDate: new Date("2026-10-11"),
      notes: "Reminder call scheduled for Sunday morning",
      isResolved: false,
    },
  });

  // Progress Reports and Assessments
  await prisma.studentProgress.create({
    data: {
      studentId: studentNaveen.id,
      subjectId: chemistry.id,
      teacherId: teacherRahul.id,
      monthYear: "2026-09",
      topicProgress: "Completed Alkanes, Alkenes, Alkynes nomenclature and Markovnikov rule.",
      homeworkCompletionRate: 95,
      areasOfImprovement: "Needs more practice with IUPAC stereochemistry notation.",
      teacherFeedback: "Consistently asks thoughtful questions. Highly disciplined.",
      coordinatorNotes: "Reviewed by Aisha Nair. Parent informed via WhatsApp summary.",
    },
  });

  await prisma.assessment.create({
    data: {
      studentId: studentNaveen.id,
      subjectId: chemistry.id,
      teacherId: teacherRahul.id,
      assessmentTitle: "Hydrocarbons Unit Assessment",
      testDate: new Date("2026-09-25"),
      score: 44,
      maxScore: 50,
      percentage: 88.0,
      feedback: "Strong conceptual clarity in electrophilic addition mechanisms.",
    },
  });

  // Parent Concern
  await prisma.parentConcern.create({
    data: {
      studentId: studentNaveen.id,
      reportedDate: new Date("2026-09-12"),
      category: "TIMING",
      description: "Parent requested shifting Wednesday session by 30 minutes to accommodate school bus delay in Dubai.",
      owner: "Aisha Nair",
      status: "RESOLVED",
      nextAction: "None",
      resolutionNotes: "Adjusted standard Wednesday slot from 6:00 PM to 6:30 PM GST. Tutors notified.",
      resolvedAt: new Date("2026-09-13"),
    },
  });

  // Payout Run
  const payoutRun = await prisma.payoutRun.create({
    data: {
      id: "run-sep-2026",
      runNumber: "PAYOUT-2026-09",
      periodStart: new Date("2026-09-01"),
      periodEnd: new Date("2026-09-30"),
      totalSessions: 10,
      totalAmount: 5800,
      currency: "INR",
      status: "APPROVED",
      approvedByName: "Devanand Nambiar (Admin)",
      approvedAt: new Date("2026-10-02"),
    },
  });

  await prisma.payoutItem.updateMany({
    where: {
      id: { in: ["poi-chem-1", "poi-chem-2", "poi-chem-3", "poi-chem-4", "poi-chem-5", "poi-chem-6", "poi-eng-1", "poi-eng-2", "poi-eng-3", "poi-eng-4"] },
    },
    data: {
      payoutRunId: payoutRun.id,
    },
  });

  console.log("🎉 Seed finished successfully! Fictional test dataset ready.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
