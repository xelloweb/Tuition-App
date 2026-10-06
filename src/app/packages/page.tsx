import { prisma } from "@/lib/prisma";
import { calculatePackageBalances } from "@/lib/package-calculations";
import { PackagesClient } from "./PackagesClient";

export default async function PackagesPage() {
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

  return <PackagesClient packages={detailedPackages} templates={templates} />;
}
