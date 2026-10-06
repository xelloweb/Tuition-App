import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { GraduationCap, Mail, Phone, Clock, DollarSign, Users, Sparkles } from "lucide-react";

export default async function TeachersPage() {
  const user = await getCurrentUser();

  const teacherWhere: any = {};
  if (user.role === "TEACHER" && user.teacherId) {
    teacherWhere.id = user.teacherId;
  }

  const teachers = await prisma.teacher.findMany({
    where: teacherWhere,
    include: {
      enrolments: {
        include: { student: true, subject: true },
      },
      sessions: {
        where: { isCreditConsumed: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const canViewAllRates = user.role === "OWNER" || user.role === "ACCOUNTS";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
          <GraduationCap className="h-4 w-4" />
          <span>Faculty & Tutor Management</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          Teachers & Tutors Directory
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Tutor profiles, subject specializations, supported grades, and rate snapshots for completed sessions.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teachers.map((teacher) => {
          const totalTaught = teacher.sessions.length;
          const assignedCount = teacher.enrolments.length;

          return (
            <div
              key={teacher.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 hover:shadow-xs transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {teacher.name}
                  </h3>
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                    {teacher.subjects}
                  </span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {teacher.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="text-xs text-slate-500 space-y-1.5 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{teacher.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{teacher.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{teacher.timeZone} ({teacher.country})</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Students</span>
                  <div className="font-bold text-slate-900 mt-0.5">{assignedCount}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Taught</span>
                  <div className="font-bold text-teal-700 mt-0.5">{totalTaught}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Rate/Hr</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {canViewAllRates || (user.role === "TEACHER" && user.teacherId === teacher.id)
                      ? `₹${teacher.defaultRate}`
                      : "Restricted"}
                  </div>
                </div>
              </div>

              {/* Supported Grades */}
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Grades:</span> {teacher.grades}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
