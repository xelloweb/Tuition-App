import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessAcademic } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!canAccessAcademic(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only Academic Coordinators or Owners can register students." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      grade,
      board = "CBSE",
      medium = "English",
      guardianName,
      whatsappNumber,
      email,
      country = "India",
      timeZone = "Asia/Kolkata",
      preferredTimings,
      learningGoals,
      coordinatorNotes,
      enrolments = [], // [{ subjectId, teacherId }]
      initialPackage, // { name, totalCredits, price, allocations: [{ subjectId, allocatedCredits }] }
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Student name is required." }, { status: 400 });
    }
    if (!guardianName?.trim()) {
      return NextResponse.json({ error: "Guardian / Parent name is required." }, { status: 400 });
    }
    if (!whatsappNumber?.trim()) {
      return NextResponse.json({ error: "WhatsApp contact number with country code is required." }, { status: 400 });
    }

    // Generate next Student Code
    const studentCount = await prisma.student.count();
    const studentCode = `XEL-2026-${(studentCount + 1).toString().padStart(3, "0")}`;

    const newStudent = await prisma.$transaction(async (tx) => {
      // 1. Create or find Guardian
      let guardian = await tx.guardian.findFirst({
        where: { whatsappNumber: whatsappNumber.trim() },
      });

      if (!guardian) {
        guardian = await tx.guardian.create({
          data: {
            name: guardianName.trim(),
            whatsappNumber: whatsappNumber.trim(),
            email: email?.trim() || null,
            country,
            timeZone,
          },
        });
      }

      // 2. Create Student
      const student = await tx.student.create({
        data: {
          studentCode,
          name: name.trim(),
          grade: grade?.trim() || "10th Grade",
          board: board?.trim() || "CBSE",
          medium: medium?.trim() || "English",
          guardianId: guardian.id,
          guardianName: guardianName.trim(),
          whatsappNumber: whatsappNumber.trim(),
          email: email?.trim() || null,
          country,
          timeZone,
          preferredTimings: preferredTimings?.trim() || null,
          learningGoals: learningGoals?.trim() || null,
          coordinatorNotes: coordinatorNotes?.trim() || null,
          status: "ACTIVE",
        },
      });

      // 3. Create Subject Enrolments
      if (Array.isArray(enrolments) && enrolments.length > 0) {
        for (const enr of enrolments) {
          if (enr.subjectId && enr.teacherId) {
            await tx.subjectEnrollment.create({
              data: {
                studentId: student.id,
                subjectId: enr.subjectId,
                teacherId: enr.teacherId,
                status: "ACTIVE",
              },
            });
          }
        }
      }

      // 4. Create Initial Package (if selected)
      if (initialPackage && Number(initialPackage.totalCredits) > 0) {
        const pkgCount = await tx.studentPackage.count();
        const packageNumber = `PKG-2026-${(pkgCount + 1).toString().padStart(3, "0")}`;
        const totalCredits = Number(initialPackage.totalCredits);
        const price = Number(initialPackage.price) || 0;

        const createdPkg = await tx.studentPackage.create({
          data: {
            packageNumber,
            studentId: student.id,
            name: initialPackage.name || `Standard ${totalCredits}-Class Package`,
            totalCredits,
            durationMinutes: 60,
            price,
            currency: "INR",
            status: "ACTIVE",
            cancellationNoticeHours: 4,
            noShowDeductCredit: true,
          },
        });

        // Add Subject Allocations
        if (Array.isArray(initialPackage.allocations) && initialPackage.allocations.length > 0) {
          for (const alloc of initialPackage.allocations) {
            const credits = Number(alloc.allocatedCredits) || 0;
            if (credits > 0) {
              await tx.subjectAllocation.create({
                data: {
                  packageId: createdPkg.id,
                  subjectId: alloc.subjectId,
                  allocatedCredits: credits,
                },
              });

              // Initial ledger entry
              await tx.creditLedger.create({
                data: {
                  packageId: createdPkg.id,
                  subjectId: alloc.subjectId,
                  eventType: "PURCHASE_INITIAL",
                  creditsDelta: credits,
                  resultingRemaining: credits,
                  reason: "Initial package purchase allocation",
                  actorRole: user.role,
                  actorName: user.name,
                },
              });
            }
          }
        }

        // Generate Billing Invoice
        if (price > 0) {
          const invCount = await tx.invoice.count();
          const invoiceNumber = `INV-2026-${(invCount + 1).toString().padStart(3, "0")}`;
          const dueDate = new Date(Date.now() + 14 * 24 * 3600 * 1000); // 14-day default

          await tx.invoice.create({
            data: {
              invoiceNumber,
              studentId: student.id,
              packageId: createdPkg.id,
              issueDate: new Date(),
              dueDate,
              subtotal: price,
              discount: 0,
              totalAmount: price,
              paidAmount: 0,
              balanceDue: price,
              currency: "INR",
              status: "UNPAID",
              items: {
                create: [
                  {
                    description: createdPkg.name,
                    quantity: 1,
                    unitPrice: price,
                    amount: price,
                  },
                ],
              },
            },
          });
        }
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "STUDENT",
          entityId: student.id,
          action: "CREATE_STUDENT",
          actorRole: user.role,
          actorName: user.name,
          details: JSON.stringify({
            studentCode,
            name: student.name,
            country,
            timeZone,
          }),
        },
      });

      return student;
    });

    return NextResponse.json({ success: true, student: newStudent });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create student" },
      { status: 400 }
    );
  }
}
