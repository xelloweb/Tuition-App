"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  GraduationCap,
  Layers,
  MessageCircle,
  Plus,
  Trash2,
  Users,
  AlertTriangle,
} from "lucide-react";
import {
  TrainerAssignedSubjectInfo,
  TrainerStudentAttendanceRecord,
} from "@/lib/services/trainer-portal";
import { MarkAttendanceModal } from "../attendance/MarkAttendanceModal";
import { EditAttendanceModal, AttendanceRecordForEdit } from "../attendance/EditAttendanceModal";
import { DeleteAttendanceModal } from "../attendance/DeleteAttendanceModal";

interface TrainerStudentProfileProps {
  student: {
    id: string;
    studentCode: string;
    name: string;
    grade: string;
    board: string;
    medium: string;
    country: string;
    whatsappNumber: string | null;
    guardianName: string | null;
  };
  assignedSubjects: TrainerAssignedSubjectInfo[];
  attendanceHistory: TrainerStudentAttendanceRecord[];
  teacherName: string;
  teacherId: string;
}

export function TrainerStudentProfile({
  student,
  assignedSubjects,
  attendanceHistory,
  teacherName,
  teacherId,
}: TrainerStudentProfileProps) {
  const router = useRouter();

  // Modal states
  const [markingSubject, setMarkingSubject] = useState<TrainerAssignedSubjectInfo | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecordForEdit | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<TrainerStudentAttendanceRecord | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const showSuccess = (text: string) => {
    setBanner({ tone: "success", text });
    setTimeout(() => setBanner(null), 6000);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Trainer Dashboard
          </Link>
          <span className="text-slate-600">•</span>
          <Link
            href="/students"
            className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            My Students
          </Link>
        </div>
        <span className="text-xs font-mono font-bold text-slate-400">
          Student ID: {student.studentCode}
        </span>
      </div>

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-xs font-semibold shadow-lg ${
            banner.tone === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/30 text-rose-200"
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-0.5 hover:text-white text-slate-400"
          >
            ✕
          </button>
        </div>
      )}

      {/* Student Banner */}
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Student Profile
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {student.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                {student.grade} • {student.board} ({student.medium})
              </span>
              <span>•</span>
              <span className="text-slate-300">{student.country}</span>
              <span>•</span>
              <span className="text-teal-400 font-medium">Times in IST</span>
            </div>
          </div>

          {student.whatsappNumber && (
            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${student.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hello, this is ${teacherName} from Xello Tuition regarding ${student.name}'s tuition classes.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-300 transition-colors shadow-md"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Parent
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Assigned Subjects & Subject-Specific Class Information */}
      <div className="space-y-6">
        {assignedSubjects.map((subject) => {
          const subjectHistory = attendanceHistory.filter((rec) => rec.subjectId === subject.subjectId);

          return (
            <section
              key={subject.subjectId}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-5 sm:p-6 shadow-xl space-y-6"
            >
              {/* Subject Title & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: subject.subjectColor || "#14b8a6" }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Assigned Subject
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {subject.subjectName}
                    <span className="text-xs font-mono font-medium text-slate-500">
                      ({subject.subjectCode})
                    </span>
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setMarkingSubject(subject)}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-teal-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-300 transition-colors shadow-md self-start sm:self-auto"
                >
                  <Plus className="h-4 w-4" />
                  Mark Attendance
                </button>
              </div>

              {/* CLASS DETAILS Metric Cards */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-teal-400" />
                  Class Details & Package Credits
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Total Allocated Classes */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between">
                    <span className="text-xs font-medium text-slate-400">Total Allocated Classes</span>
                    <div className="mt-2">
                      {subject.hasSubjectAllocation && subject.allocatedCredits !== null ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white tabular-nums">
                            {subject.allocatedCredits}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">Classes</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Subject Credit Allocation Not Set
                        </div>
                      )}
                    </div>
                    <span className="mt-2 text-[11px] text-slate-500">
                      {subject.hasSubjectAllocation
                        ? "Subject-specific allocation"
                        : "Awaiting Coordinator credit allocation"}
                    </span>
                  </div>

                  {/* Completed Classes */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between">
                    <span className="text-xs font-medium text-slate-400">Completed Classes</span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white tabular-nums">
                        {subject.completedClasses}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">Classes</span>
                    </div>
                    <span className="mt-2 text-[11px] text-slate-500">
                      Confirmed attendance hours
                    </span>
                  </div>

                  {/* Remaining Classes */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between">
                    <span className="text-xs font-medium text-slate-400">Remaining Classes</span>
                    <div className="mt-2">
                      {subject.hasSubjectAllocation && subject.remainingCredits !== null ? (
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-2xl font-black tabular-nums ${
                              subject.remainingCredits <= 2
                                ? "text-rose-400"
                                : subject.remainingCredits <= 4
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {subject.remainingCredits}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">Classes</span>
                        </div>
                      ) : (
                        <span className="text-xl font-bold text-slate-500">—</span>
                      )}
                    </div>
                    <span className="mt-2 text-[11px] text-slate-500">
                      {subject.hasSubjectAllocation ? "Active class credits" : "Allocation not set"}
                    </span>
                  </div>
                </div>
              </div>

              {/* CLASS TIMETABLE */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-teal-400" />
                  Class Timetable (Assigned Slots)
                </h3>

                {subject.schedules.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-xs text-slate-400">
                    No recurring timetable slots configured for {subject.subjectName} yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {subject.schedules.map((slot) => (
                      <div
                        key={slot.slotId}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5"
                      >
                        <Clock className="h-4 w-4 text-teal-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-white">{slot.weekdayName}</div>
                          <div className="text-xs text-slate-400">{slot.timeDisplay.split(": ")[1]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ATTENDANCE SECTION */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                    Attendance History ({subjectHistory.length})
                  </h3>

                  <button
                    type="button"
                    onClick={() => setMarkingSubject(subject)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-400 hover:text-teal-300"
                  >
                    <Plus className="h-3.5 w-3.5" /> Mark New Class Attendance
                  </button>
                </div>

                {subjectHistory.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-5 text-center text-xs text-slate-400">
                    No attendance records logged yet for {subject.subjectName}.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Duration / Hours</th>
                          <th className="px-4 py-3 font-semibold">Topic Covered</th>
                          <th className="px-4 py-3 font-semibold">Marked By</th>
                          <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {subjectHistory.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                              {rec.classDate}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-bold text-teal-300">
                                {rec.hoursCompleted} hr(s)
                              </span>{" "}
                              <span className="text-slate-500">
                                ({rec.hoursCompleted} credit{rec.hoursCompleted > 1 ? "s" : ""})
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate text-slate-300">
                              {rec.topicCovered || <span className="text-slate-500">—</span>}
                              {rec.homework && (
                                <span className="block text-[11px] text-slate-400 truncate">
                                  HW: {rec.homework}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                              {rec.markedByName}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingRecord({
                                      id: rec.id,
                                      studentName: student.name,
                                      subjectName: rec.subjectName,
                                      teacherName: teacherName,
                                      classDate: rec.classDate,
                                      durationMinutes: rec.durationMinutes,
                                      topicCovered: rec.topicCovered ?? "",
                                      homework: rec.homework ?? "",
                                      studentProgressNote: rec.studentProgressNote ?? "",
                                    })
                                  }
                                  className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:border-slate-600 hover:text-white"
                                  title="Edit Attendance"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingRecord(rec)}
                                  className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                                  title="Delete Attendance"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Mark Attendance Modal (with pre-selected student & subject) */}
      {markingSubject && (
        <MarkAttendanceModal
          isOpen={true}
          onClose={() => setMarkingSubject(null)}
          onSuccess={(msg) => {
            setMarkingSubject(null);
            showSuccess(msg);
          }}
          isTrainer={true}
          preselectedStudent={{
            id: student.id,
            name: student.name,
            grade: student.grade,
            assignedSubjects: [
              { id: markingSubject.subjectId, name: markingSubject.subjectName },
            ],
          }}
          preselectedSubject={{
            id: markingSubject.subjectId,
            name: markingSubject.subjectName,
          }}
        />
      )}

      {/* Edit Attendance Modal */}
      {editingRecord && (
        <EditAttendanceModal
          isOpen={true}
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSuccess={(msg) => {
            setEditingRecord(null);
            showSuccess(msg);
          }}
        />
      )}

      {/* Delete Attendance Modal */}
      {deletingRecord && (
        <DeleteAttendanceModal
          isOpen={true}
          record={{
            id: deletingRecord.id,
            studentName: student.name,
            subjectName: deletingRecord.subjectName,
            teacherName: teacherName,
            durationMinutes: deletingRecord.durationMinutes,
            hoursCompleted: deletingRecord.hoursCompleted,
          }}
          onClose={() => setDeletingRecord(null)}
          onSuccess={(msg) => {
            setDeletingRecord(null);
            showSuccess(msg);
          }}
        />
      )}
    </div>
  );
}
