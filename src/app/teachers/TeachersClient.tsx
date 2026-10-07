"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Mail,
  Phone,
  Clock,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Power,
  X,
} from "lucide-react";
import { RATE_TIERS, getTierRate } from "@/lib/rates";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { AddTeacherModal } from "@/components/teachers/AddTeacherModal";
import { EditTeacherModal } from "@/components/teachers/EditTeacherModal";
import { TeacherFormRecord } from "@/components/teachers/TeacherFormModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { Button } from "@/components/ui/Button";

export interface TeacherListItem extends TeacherFormRecord {
  ratesVisible: boolean;
  assignedCount: number;
  taughtCount: number;
}

interface TeachersClientProps {
  teachers: TeacherListItem[];
  canManage: boolean;
  canSetRates: boolean;
  currentRole: string;
  availableSubjects?: { id: string; name: string }[];
}

/**
 * Server-confirmed changes shown until the refreshed server list arrives.
 * Tied to the props array it was made against, so fresh server data always wins.
 */
interface Overlay {
  base: TeacherListItem[];
  upserts: TeacherListItem[];
  removedIds: string[];
}

export function TeachersClient({
  teachers,
  canManage,
  canSetRates,
  currentRole,
  availableSubjects = [],
}: TeachersClientProps) {
  const router = useRouter();
  const [overlay, setOverlay] = useState<Overlay>({ base: teachers, upserts: [], removedIds: [] });
  const [addOpen, setAddOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherListItem | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<TeacherListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [banner, setBanner] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);

  const teachersList = useMemo(() => {
    const active = overlay.base === teachers ? overlay : { upserts: [], removedIds: [] as string[] };
    const byId = new Map(teachers.map((t) => [t.id, t]));
    for (const t of active.upserts) byId.set(t.id, { ...byId.get(t.id), ...t });
    for (const id of active.removedIds) byId.delete(id);
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [teachers, overlay]);

  const applyOverlay = (change: Partial<Pick<Overlay, "upserts" | "removedIds">>) => {
    setOverlay((prev) => {
      const current = prev.base === teachers ? prev : { base: teachers, upserts: [], removedIds: [] };
      return {
        base: teachers,
        upserts: [...current.upserts.filter((u) => !change.upserts?.some((c) => c.id === u.id)), ...(change.upserts ?? [])],
        removedIds: [...current.removedIds, ...(change.removedIds ?? [])],
      };
    });
  };

  const handleSaved = (teacher: TeacherFormRecord, info: { message: string; warning?: string }, existing?: TeacherListItem) => {
    applyOverlay({
      upserts: [
        {
          ratesVisible: existing?.ratesVisible ?? canSetRates,
          assignedCount: existing?.assignedCount ?? 0,
          taughtCount: existing?.taughtCount ?? 0,
          ...teacher,
        } as TeacherListItem,
      ],
    });
    setBanner(info.warning ? { tone: "warning", text: `${info.message} ${info.warning}` } : { tone: "success", text: info.message });
    router.refresh();
  };

  const handleToggleActive = async (teacher: TeacherListItem) => {
    if (teacher.active && !confirm(`Deactivate ${teacher.name}? They will be hidden from new assignments; history and payouts are kept.`)) {
      return;
    }
    setTogglingId(teacher.id);
    try {
      const data = await apiRequest<{ teacher: TeacherFormRecord; warning?: string }>(`/api/teachers/${teacher.id}`, {
        method: "PATCH",
        body: { active: !teacher.active },
      });
      handleSaved(
        data.teacher,
        { message: `${data.teacher.name} is now ${data.teacher.active ? "active" : "inactive"}.`, warning: data.warning },
        teacher
      );
    } catch (err) {
      setBanner({ tone: "error", text: errorMessage(err) });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deletingTeacher) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const data = await apiRequest<{ message: string }>(`/api/teachers/${deletingTeacher.id}`, { method: "DELETE" });
      applyOverlay({ removedIds: [deletingTeacher.id] });
      setBanner({ tone: "success", text: data.message });
      setDeletingTeacher(null);
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err, "Could not remove this trainer."));
      if (err instanceof ClientApiError && err.status === 404) router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleInvite = async (teacher: TeacherListItem) => {
    try {
      const res = await fetch(`/api/teachers/${teacher.id}/invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBanner({ tone: "success", text: `Invite link generated: ${data.inviteLink}` });
    } catch (err: any) {
      setBanner({ tone: "error", text: errorMessage(err, "Failed to generate invite.") });
    }
  };

  const filteredTeachers = teachersList.filter((teacher) => {
    const q = searchQuery.toLowerCase().trim();
    const haystack = [teacher.name, teacher.subjects, teacher.email, teacher.grades].join(" ").toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (selectedSubject !== "ALL" && !teacher.subjects.toLowerCase().includes(selectedSubject.toLowerCase())) return false;
    if (statusFilter === "ACTIVE" && !teacher.active) return false;
    if (statusFilter === "INACTIVE" && teacher.active) return false;
    return true;
  });

  const allSubjects = Array.from(
    new Set(teachersList.flatMap((t) => t.subjects.split(",").map((s) => s.trim()).filter(Boolean)))
  ).sort();

  const isTeacherView = currentRole === "TEACHER";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
            <GraduationCap className="h-4 w-4" />
            <span>Faculty & Trainer Management</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white mt-1">
            {isTeacherView ? "My Trainer Profile" : "Trainers & Tutors Directory"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Trainer profiles, subject specializations, supported grades, and standard-wise pay matrices.
          </p>
        </div>

        {canManage && (
          <Button onClick={() => setAddOpen(true)} icon={Plus} className="w-full sm:w-auto">
            Add New Trainer
          </Button>
        )}
      </div>

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 text-xs font-semibold ${
            banner.tone === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : banner.tone === "warning"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                : "bg-rose-500/15 border-rose-500/30 text-rose-200"
          }`}
        >
          <div className="flex items-start gap-2">
            {banner.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} aria-label="Dismiss message" className="p-1 hover:text-white shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      {!isTeacherView && (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-3 sm:p-4 shadow-xl shadow-black/30 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trainers by name, subject, grade or email..."
                aria-label="Search trainers"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 min-h-[44px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                aria-label="Filter by subject"
                className="flex-1 sm:flex-none rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 min-h-[44px] text-xs font-medium text-slate-200 focus:outline-hidden"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">All Subjects</option>
                {allSubjects.map((sub) => (
                  <option key={sub} value={sub} className="bg-slate-900 text-slate-200">{sub}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                aria-label="Filter by status"
                className="flex-1 sm:flex-none rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 min-h-[44px] text-xs font-medium text-slate-200 focus:outline-hidden"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">All Statuses</option>
                <option value="ACTIVE" className="bg-slate-900 text-slate-200">Active</option>
                <option value="INACTIVE" className="bg-slate-900 text-slate-200">Inactive</option>
              </select>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Showing {filteredTeachers.length} of {teachersList.length} trainer{teachersList.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {/* Grid */}
      {filteredTeachers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <GraduationCap className="h-10 w-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-extrabold text-white">No trainers found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || selectedSubject !== "ALL" || statusFilter !== "ALL"
              ? "Try adjusting your search or clearing the filters."
              : isTeacherView
                ? "Your login is not linked to a trainer profile yet. Ask the owner to link it."
                : "No trainers have been registered yet."}
          </p>
          {canManage && !searchQuery && selectedSubject === "ALL" && statusFilter === "ALL" && (
            <div className="pt-2">
              <Button variant="primary" size="md" icon={Plus} onClick={() => setAddOpen(true)}>
                Register First Trainer
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeachers.map((teacher) => {
            const subjectsList = teacher.subjects.split(",").map((s) => s.trim()).filter(Boolean);
            const hasHistory = teacher.assignedCount > 0 || teacher.taughtCount > 0;

            return (
              <div
                key={teacher.id}
                className={`rounded-2xl sm:rounded-3xl border bg-slate-900/60 backdrop-blur-xl p-5 sm:p-6 shadow-xl shadow-black/40 space-y-4 transition-all ${
                  teacher.active ? "border-slate-800/80 hover:border-teal-500/40" : "border-slate-800/60 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-base text-white break-words">{teacher.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {subjectsList.map((sub) => (
                        <span
                          key={sub}
                          className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2.5 py-0.5 text-[11px] font-bold text-teal-300"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      teacher.active
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {teacher.active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-300 min-w-0">
                    <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{teacher.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono">{teacher.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>{teacher.timeZone} ({teacher.country})</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900/90 p-3 text-center text-xs border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Students</span>
                    <div className="font-extrabold text-white mt-0.5">{teacher.assignedCount}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Taught</span>
                    <div className="font-extrabold text-teal-400 mt-0.5">{teacher.taughtCount}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Rate/Hr</span>
                    <div className="font-extrabold text-white mt-0.5">
                      {teacher.ratesVisible && teacher.defaultRate !== null ? `₹${teacher.defaultRate}` : "Restricted"}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  <span className="font-bold text-slate-300">Grades:</span> {teacher.grades || "All Grades"}
                </div>

                {teacher.ratesVisible && teacher.defaultRate !== null && (
                  <div className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-teal-300">
                      <span>Standard Hourly Pay Rates</span>
                      <span className="text-[10px] text-teal-400/80 font-normal">Per Hour Taught</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      {RATE_TIERS.map((tier) => (
                        <div key={tier.key} className="rounded-xl bg-slate-900/90 p-1.5 border border-slate-800">
                          <span className="text-slate-400 block font-medium leading-tight">{tier.label}</span>
                          <span className="font-black text-white">₹{getTierRate(teacher, tier.key)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 text-center pt-0.5">
                      Calculation: <span className="font-semibold text-slate-300">Hourly Rate × Class Hours</span>
                    </div>
                  </div>
                )}

                {canManage && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleInvite(teacher)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 min-h-[40px] text-xs font-semibold text-teal-300 hover:text-teal-200 hover:bg-teal-500/20 transition-colors"
                      title="Send Invite"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Invite
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTeacher(teacher)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 py-2 min-h-[40px] text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-teal-400" />
                      Edit Details
                    </button>
                    {hasHistory || !teacher.active ? (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(teacher)}
                        disabled={togglingId === teacher.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 min-h-[40px] text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                        title={teacher.active ? "Deactivate (keeps history)" : "Reactivate"}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {teacher.active ? "Deactivate" : "Reactivate"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingTeacher(teacher);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 min-h-[40px] text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors"
                        title="Remove trainer (only possible before any assignments)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AddTeacherModal
          availableSubjects={availableSubjects}
          canSetRates={canSetRates}
          onClose={() => setAddOpen(false)}
          onSuccess={(teacher, info) => {
            setAddOpen(false);
            setSearchQuery("");
            setSelectedSubject("ALL");
            setStatusFilter("ALL");
            handleSaved(teacher, info);
          }}
        />
      )}

      {editingTeacher && (
        <EditTeacherModal
          teacher={editingTeacher}
          availableSubjects={availableSubjects}
          canSetRates={canSetRates && editingTeacher.ratesVisible}
          onClose={() => setEditingTeacher(null)}
          onSuccess={(teacher, info) => {
            const existing = editingTeacher;
            setEditingTeacher(null);
            handleSaved(teacher, info, existing);
          }}
        />
      )}

      {deletingTeacher && (
        <DeleteConfirmModal
          title="Remove Trainer Profile"
          message={`Permanently remove "${deletingTeacher.name}"? This is only allowed for profiles created by mistake that have no students, sessions or payouts.`}
          itemName={deletingTeacher.name}
          itemDetails={`${deletingTeacher.subjects} • ${deletingTeacher.email}`}
          confirmLabel="Yes, Remove Trainer"
          loading={deleteLoading}
          errorMessage={deleteError}
          alternativeAction={
            deleteError && deletingTeacher.active
              ? {
                  label: "Deactivate instead",
                  onClick: () => {
                    const target = deletingTeacher;
                    setDeletingTeacher(null);
                    void handleToggleActive({ ...target, active: true });
                  },
                }
              : undefined
          }
          onConfirm={handleDeleteTeacher}
          onCancel={() => setDeletingTeacher(null)}
        />
      )}
    </div>
  );
}
