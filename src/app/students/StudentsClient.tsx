"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  ArrowRight,
  Globe,
  Plus,
  Filter,
  X,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Edit2,
  Trash2,
} from "lucide-react";
import { AddStudentModal } from "@/components/students/AddStudentModal";
import { EditStudentModal } from "@/components/students/EditStudentModal";
import { SubjectOption, TeacherOption } from "@/components/students/StudentFormModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { GRADE_FILTER_OPTIONS } from "@/lib/grades";
import { COUNTRIES, STUDENT_STATUSES } from "@/lib/constants";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";

interface StudentsClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  students: any[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  canAddStudent: boolean;
  isTeacherView?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StudentRow = any;

/** Server-confirmed changes shown until the refreshed server list (a new props array) arrives. */
interface Overlay {
  base: StudentRow[];
  upserts: StudentRow[];
  removedIds: string[];
}

const PAGE_SIZE = 30;

export function StudentsClient({ students, subjects, teachers, canAddStudent, isTeacherView = false }: StudentsClientProps) {
  const router = useRouter();
  const [overlay, setOverlay] = useState<Overlay>({ base: students, upserts: [], removedIds: [] });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string; href?: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("ALL");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("CURRENT");
  const [lowBalanceOnly, setLowBalanceOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const studentsList = useMemo(() => {
    const active = overlay.base === students ? overlay : { upserts: [] as StudentRow[], removedIds: [] as string[] };
    const byId = new Map<string, StudentRow>(students.map((s) => [s.id, s]));
    const created: StudentRow[] = [];
    for (const s of active.upserts) {
      if (byId.has(s.id)) byId.set(s.id, { ...byId.get(s.id), ...s });
      else created.push(s);
    }
    for (const id of active.removedIds) byId.delete(id);
    return [...created, ...byId.values()];
  }, [students, overlay]);

  const applyOverlay = (change: { upserts?: StudentRow[]; removedIds?: string[] }) => {
    setOverlay((prev) => {
      const current = prev.base === students ? prev : { base: students, upserts: [], removedIds: [] };
      return {
        base: students,
        upserts: [...current.upserts.filter((u) => !change.upserts?.some((c) => c.id === u.id)), ...(change.upserts ?? [])],
        removedIds: [...current.removedIds, ...(change.removedIds ?? [])],
      };
    });
  };

  const setFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setVisibleCount(PAGE_SIZE);
  };

  const activeFiltersCount =
    (selectedCountry !== "ALL" ? 1 : 0) +
    (selectedGrade !== "ALL" ? 1 : 0) +
    (selectedStatus !== "CURRENT" ? 1 : 0) +
    (lowBalanceOnly ? 1 : 0);

  const resetFilters = () => {
    setSelectedCountry("ALL");
    setSelectedGrade("ALL");
    setSelectedStatus("CURRENT");
    setLowBalanceOnly(false);
    setSearchQuery("");
    setVisibleCount(PAGE_SIZE);
  };

  const balanceOf = (s: StudentRow) => {
    const activePkg = s.packages?.[0];
    const consumed = activePkg?.sessions?.length || 0;
    return { activePkg, consumed, remaining: activePkg ? activePkg.totalCredits - consumed : 0 };
  };

  const filteredStudents = studentsList.filter((s) => {
    if (selectedCountry !== "ALL" && s.country !== selectedCountry) return false;
    if (selectedGrade !== "ALL") {
      const g = String(s.grade || "").toLowerCase();
      const sel = selectedGrade.toLowerCase();
      if (sel === "kg") {
        if (!g.includes("kg") && !g.includes("kindergarten")) return false;
      } else if (sel === "11th") {
        if (!g.includes("11th") && !g.includes("+1") && !g.includes("plus one")) return false;
      } else if (sel === "12th") {
        if (!g.includes("12th") && !g.includes("+2") && !g.includes("plus two")) return false;
      } else if (!g.includes(sel)) {
        return false;
      }
    }
    if (selectedStatus === "CURRENT" && s.status === "WITHDRAWN") return false;
    if (selectedStatus !== "CURRENT" && selectedStatus !== "ALL" && s.status !== selectedStatus) return false;
    if (lowBalanceOnly && balanceOf(s).remaining > 3) return false;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const digits = q.replace(/\D/g, "");
      const matchText = [s.name, s.studentCode, s.guardianName].some((v) => String(v || "").toLowerCase().includes(q));
      const matchPhone = digits.length >= 4 && String(s.whatsappNumber || "").replace(/\D/g, "").includes(digits);
      if (!matchText && !matchPhone) return false;
    }
    return true;
  });

  const handleDeleteStudent = async () => {
    if (!deletingStudent) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const data = await apiRequest<{ message: string }>(`/api/students/${deletingStudent.id}`, { method: "DELETE" });
      applyOverlay({ removedIds: [deletingStudent.id] });
      setBanner({ tone: "success", text: data.message });
      setDeletingStudent(null);
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err, "Could not remove this student."));
      if (err instanceof ClientApiError && err.status === 404) router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleArchiveStudent = async (student: StudentRow) => {
    setDeleteLoading(true);
    try {
      const data = await apiRequest<{ student: StudentRow }>(`/api/students/${student.id}`, {
        method: "PATCH",
        body: { status: "WITHDRAWN" },
      });
      applyOverlay({ upserts: [data.student] });
      setBanner({ tone: "success", text: `${student.name} archived (status: Withdrawn). Records are kept and can be restored from Edit.` });
      setDeletingStudent(null);
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err, "Could not archive this student."));
    } finally {
      setDeleteLoading(false);
    }
  };

  const filterControls = (variant: "row" | "sheet") => {
    const selectClass =
      variant === "row"
        ? "rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 min-h-[36px] font-medium text-slate-200 focus:outline-hidden"
        : "w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 font-medium text-white min-touch-target focus:border-teal-500 focus:outline-hidden";
    return {
      country: (
        <select aria-label="Filter by country" value={selectedCountry} onChange={(e) => setFilter(setSelectedCountry)(e.target.value)} className={selectClass}>
          <option value="ALL" className="bg-slate-900 text-slate-200">All Countries</option>
          {COUNTRIES.map((c) => (
            <option key={c.value} value={c.value} className="bg-slate-900 text-slate-200">{c.flag} {c.label}</option>
          ))}
        </select>
      ),
      grade: (
        <select aria-label="Filter by grade" value={selectedGrade} onChange={(e) => setFilter(setSelectedGrade)(e.target.value)} className={selectClass}>
          {GRADE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">{opt.label}</option>
          ))}
        </select>
      ),
      status: (
        <select aria-label="Filter by status" value={selectedStatus} onChange={(e) => setFilter(setSelectedStatus)(e.target.value)} className={selectClass}>
          <option value="CURRENT" className="bg-slate-900 text-slate-200">Current (hide archived)</option>
          <option value="ALL" className="bg-slate-900 text-slate-200">All statuses</option>
          {STUDENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value} className="bg-slate-900 text-slate-200">{s.label}</option>
          ))}
        </select>
      ),
    };
  };

  const rowFilters = filterControls("row");
  const sheetFilters = filterControls("sheet");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
            <Users className="h-4 w-4" />
            <span>Academic Registry</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white mt-1">
            {isTeacherView ? "My Students" : "Students Directory"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Profiles for Kerala and GCC expatriate students (UAE, Saudi Arabia, Qatar, Oman, Kuwait, Bahrain).
          </p>
        </div>

        {canAddStudent && (
          <Button onClick={() => setAddModalOpen(true)} icon={Plus} className="w-full sm:w-auto">
            Add New Student
          </Button>
        )}
      </div>

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 text-xs font-semibold ${
            banner.tone === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-rose-500/15 border-rose-500/30 text-rose-200"
          }`}
        >
          <div className="flex items-start gap-2">
            {banner.tone === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>
              {banner.text}{" "}
              {banner.href && (
                <Link href={banner.href} className="underline underline-offset-2 hover:text-white whitespace-nowrap">
                  Open profile →
                </Link>
              )}
            </span>
          </div>
          <button onClick={() => setBanner(null)} aria-label="Dismiss message" className="p-1 hover:text-white shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-3 sm:p-4 shadow-xl shadow-black/30 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setFilter(setSearchQuery)(e.target.value)}
              placeholder="Search by name, student ID, guardian or phone..."
              aria-label="Search students"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 min-touch-target"
            />
            {searchQuery && (
              <button
                onClick={() => setFilter(setSearchQuery)("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="sm:hidden flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 min-touch-target shrink-0"
          >
            <Filter className="h-4 w-4 text-teal-400" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-teal-500 text-slate-950 px-1.5 text-[10px] font-black">{activeFiltersCount}</span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800/80 text-xs">
          {rowFilters.country}
          {rowFilters.grade}
          {rowFilters.status}
          <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 min-h-[36px] select-none hover:bg-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={lowBalanceOnly}
              onChange={(e) => setFilter(setLowBalanceOnly)(e.target.checked)}
              className="h-4 w-4 rounded accent-teal-500"
            />
            <span className="font-semibold text-slate-300">≤3 Classes Left</span>
          </label>
          {activeFiltersCount > 0 && (
            <button onClick={resetFilters} className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400 font-bold ml-auto px-2 py-1 transition-colors">
              <RotateCcw className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Student List */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
            Students ({filteredStudents.length}{filteredStudents.length !== studentsList.length ? ` of ${studentsList.length}` : ""})
          </span>
          <span className="text-xs text-slate-400">Tap any card to view the student profile</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {filteredStudents.length === 0 ? (
            <div className="p-6 sm:p-14 text-center">
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/90 border border-slate-700/80 text-teal-400">
                  <Users className="h-7 w-7 text-teal-400" />
                </div>
                <h3 className="mt-4 text-base font-extrabold text-white">
                  {studentsList.length === 0 ? (isTeacherView ? "No students assigned to you yet" : "No students registered yet") : "No students match these filters"}
                </h3>
                <p className="mt-1.5 max-w-sm text-xs text-slate-400 leading-relaxed">
                  {studentsList.length === 0
                    ? "Start enrolling students with their grade (KG to Plus Two), curriculum, and parent WhatsApp contact."
                    : "Try clearing the search or filters."}
                </p>
                {studentsList.length > 0 && activeFiltersCount + (searchQuery ? 1 : 0) > 0 && (
                  <div className="mt-4">
                    <Button variant="outline" size="sm" onClick={resetFilters}>Reset filters</Button>
                  </div>
                )}
                {canAddStudent && studentsList.length === 0 && (
                  <div className="mt-6">
                    <Button size="md" onClick={() => setAddModalOpen(true)}>Add First Student</Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            filteredStudents.slice(0, visibleCount).map((student) => {
              const { activePkg, consumed, remaining } = balanceOf(student);
              const isLowBalance = remaining <= 3 && remaining > 0;

              return (
                <div key={student.id} className="relative hover:bg-slate-800/40 transition-colors">
                  <Link
                    href={`/students/${student.id}`}
                    className="block p-4 sm:p-5 focus:outline-hidden focus-visible:bg-slate-800/60"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-extrabold text-white break-words">{student.name}</span>
                          <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-mono font-bold text-slate-300">
                            {student.studentCode}
                          </span>
                          <StatusBadge status={student.status} size="sm" />
                          {isLowBalance && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                              <AlertTriangle className="h-3 w-3" /> Low Balance
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                          <span className="font-semibold text-slate-300">
                            {student.grade} • {student.board} ({student.medium})
                          </span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Globe className="h-3 w-3 text-teal-400" />
                            {student.country} ({student.timeZone})
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {student.enrolments?.map((enr: StudentRow) => (
                            <span
                              key={enr.id}
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-slate-300 bg-slate-800/90 border border-slate-700/80"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: enr.subject?.color || "#14b8a6" }} />
                              {enr.subject?.name}{" "}
                              {enr.teacher ? `(${enr.teacher.name?.split(" ")[0]})` : <em className="text-amber-300 not-italic">(no trainer yet)</em>}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className={`flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 shrink-0 ${canAddStudent ? "pr-24 sm:pr-24" : ""}`}>
                        {activePkg ? (
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Classes Balance</span>
                            <div className="text-sm font-bold text-white tabular-nums font-mono">
                              <span className={isLowBalance ? "text-rose-400 font-black" : "text-teal-400 font-black"}>{remaining}</span> /{" "}
                              {activePkg.totalCredits} Available
                            </div>
                            <div className="text-[11px] text-slate-400">{consumed} taught</div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic">No active package</div>
                        )}
                        <div className="flex items-center gap-1 text-xs font-bold text-teal-300 bg-teal-500/15 px-3 py-1.5 rounded-xl border border-teal-500/30 sm:bg-transparent sm:border-0 sm:p-0">
                          <span className="sm:hidden">Profile</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Actions sit outside the link so taps never trigger navigation. */}
                  {canAddStudent && (
                    <div className="absolute right-4 sm:right-12 bottom-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingStudent(student)}
                        className="rounded-xl p-2 min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Edit student"
                        aria-label={`Edit ${student.name}`}
                      >
                        <Edit2 className="h-3.5 w-3.5 text-teal-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingStudent(student);
                        }}
                        className="rounded-xl p-2 min-h-[40px] min-w-[40px] flex items-center justify-center border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors"
                        title="Remove or archive student"
                        aria-label={`Remove or archive ${student.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {filteredStudents.length > visibleCount && (
          <div className="p-4 border-t border-slate-800/80 text-center">
            <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, filteredStudents.length - visibleCount)} more ({filteredStudents.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Filter Sheet */}
      {filterSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:hidden">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md" onClick={() => setFilterSheetOpen(false)} />
          <div className="relative z-10 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-[#0c1220] p-5 shadow-2xl border-t border-slate-800 pb-safe space-y-4 text-white">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Filter Students</h3>
              <button onClick={() => setFilterSheetOpen(false)} aria-label="Close filters" className="p-2 text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-300 block mb-1">Country</span>
                {sheetFilters.country}
              </div>
              <div>
                <span className="font-bold text-slate-300 block mb-1">Grade / Standard</span>
                {sheetFilters.grade}
              </div>
              <div>
                <span className="font-bold text-slate-300 block mb-1">Status</span>
                {sheetFilters.status}
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-900/80 min-touch-target cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lowBalanceOnly}
                    onChange={(e) => setFilter(setLowBalanceOnly)(e.target.checked)}
                    className="h-4 w-4 rounded-sm accent-teal-500"
                  />
                  <span className="font-bold text-slate-200">Only Low Balance (≤3 classes)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
              <Button variant="outline" className="flex-1" onClick={() => { resetFilters(); setFilterSheetOpen(false); }}>
                Reset All
              </Button>
              <Button className="flex-1" onClick={() => setFilterSheetOpen(false)}>
                Show {filteredStudents.length} students
              </Button>
            </div>
          </div>
        </div>
      )}

      {addModalOpen && (
        <AddStudentModal
          subjects={subjects}
          teachers={teachers}
          onClose={() => setAddModalOpen(false)}
          onSuccess={(newStudent, message) => {
            setAddModalOpen(false);
            resetFilters();
            applyOverlay({ upserts: [newStudent] });
            setBanner({ tone: "success", text: message, href: `/students/${newStudent.id}` });
            router.refresh();
          }}
        />
      )}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          subjects={subjects}
          teachers={teachers}
          onClose={() => setEditingStudent(null)}
          onSuccess={(updatedStudent, message) => {
            setEditingStudent(null);
            applyOverlay({ upserts: [updatedStudent] });
            setBanner({ tone: "success", text: message });
            router.refresh();
          }}
        />
      )}

      {deletingStudent && (
        <DeleteConfirmModal
          title="Remove Student Profile"
          message={`Permanently remove "${deletingStudent.name}" (${deletingStudent.studentCode})? Only possible for records created by mistake with no packages, sessions, invoices or payments. Otherwise archive the student.`}
          itemName={`${deletingStudent.name} (${deletingStudent.studentCode})`}
          itemDetails={`${deletingStudent.grade} • Guardian: ${deletingStudent.guardianName} (${deletingStudent.whatsappNumber})`}
          confirmLabel="Yes, Remove Student"
          loading={deleteLoading}
          errorMessage={deleteError}
          alternativeAction={
            deletingStudent.status !== "WITHDRAWN"
              ? { label: "Archive instead", onClick: () => handleArchiveStudent(deletingStudent) }
              : undefined
          }
          onConfirm={handleDeleteStudent}
          onCancel={() => setDeletingStudent(null)}
        />
      )}
    </div>
  );
}
