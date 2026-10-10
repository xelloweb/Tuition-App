import { prisma } from "@/lib/prisma";
import { getCurrentUser, canReallocatePackages, canAssignExistingPayments, canEditPackages } from "@/lib/auth";
import { studentsNeedingPackageSetup } from "@/lib/services/existing-payment-packages";
import { reviewAutoPackages } from "@/lib/services/auto-package-cleanup";
import { calculatePackageBalances } from "@/lib/package-calculations";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PackagesClient } from "./PackagesClient";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const user = await getCurrentUser();
  if (!canReallocatePackages(user.role)) {
    return <AccessDenied message="Packages and credit allocation are managed by the owner and academic coordinators." />;
  }
  const studentPackages = await prisma.studentPackage.findMany({
    include: {
      student: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const templates = await prisma.packageTemplate.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Calculate detailed balance breakdowns for all packages
  const detailedPackages: any[] = [];

  for (const pkg of studentPackages) {
    const balances = await calculatePackageBalances(pkg.id);
    if (balances) {
      detailedPackages.push({
        ...balances,
        studentName: pkg.student.name,
        studentCode: pkg.student.studentCode,
        studentCountry: pkg.student.country,
        studentGrade: pkg.student.grade,
        price: pkg.price,
        currency: pkg.currency,
      });
    }
  }

  // Owner only: students whose money already paid is not yet a working package.
  const needsSetup = canAssignExistingPayments(user.role) ? await studentsNeedingPackageSetup() : [];

  // Owner only: packages created automatically from payment records, to review and remove.
  const auto = user.role === "OWNER" ? await reviewAutoPackages() : null;
  const autoPackages = auto ? { removable: auto.removable.length, kept: auto.kept.length } : null;

  return (
    <PackagesClient
      packages={detailedPackages}
      templates={templates}
      needsSetup={needsSetup}
      canEdit={canEditPackages(user.role)}
      autoPackages={autoPackages}
    />
  );
}
