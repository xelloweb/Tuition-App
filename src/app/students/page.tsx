import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Users, Search, ArrowRight, ShieldCheck, Globe, GraduationCap } from "lucide-react";

export default async function StudentsPage() {
  const students = await prisma.student.findMany({
    include: {
      packages: {
        where: { status: "ACTIVE" },
        include: {
          sessions: { where: { isCreditConsumed: true } },
        },
      },
      enrolments: {
        include: { subject: true, teacher: true },
      },
      guardian: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <Users className="h-4 w-4" />
            <span>Academic Registry</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Students Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Profiles for Kerala and GCC expatriate students (UAE, Saudi Arabia, Qatar).
          </p>
        </div>
      </div>

      {/* Student Cards & Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Enrolled Students ({students.length})
          </span>
          <span className="text-xs text-slate-400">
            Click any profile to view all 9 operational tabs
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {students.map((student) => {
            const activePkg = student.packages[0];
            const consumed = activePkg?.sessions.length || 0;
            const remaining = activePkg ? activePkg.totalCredits - consumed : 0;

            return (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="block p-5 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-slate-900">
                        {student.name}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-700">
                        {student.studentCode}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {student.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{student.grade} • {student.board} ({student.medium})</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Globe className="h-3 w-3 text-teal-600" />
                        {student.country} ({student.timeZone})
                      </span>
                      <span>•</span>
                      <span>Parent: {student.guardianName} ({student.whatsappNumber})</span>
                    </div>

                    {/* Enrolled subjects pill */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {student.enrolments.map((enr) => (
                        <span
                          key={enr.id}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-slate-100"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: enr.subject.color }}
                          />
                          {enr.subject.name} ({enr.teacher.name.split(" ")[0]})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right side: Package balance summary */}
                  <div className="flex items-center justify-between sm:justify-end gap-5">
                    {activePkg ? (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Package Balance
                        </span>
                        <div className="text-sm font-bold text-slate-800">
                          <span className="text-teal-700 font-black">{remaining}</span> / {activePkg.totalCredits} Remaining
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {consumed} classes completed
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        No active package
                      </div>
                    )}

                    <div className="rounded-full bg-slate-100 p-2 text-slate-400 group-hover:text-slate-600">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
