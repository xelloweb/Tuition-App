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
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDays } from "@/lib/trainer-profile";
import Link from "next/link";
import { FileSpreadsheet, MapPin } from "lucide-react";

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
      const data = await apiRequest<{ inviteLink: string; expiresAt: string }>(`/api/teachers/${teacher.id}/invite`, { method: "POST" });
      setBanner({
        tone: "success",
        text: `Login link for ${teacher.name} (works once, valid 7 days). Nothing was sent: copy it and send it to them yourself: ${data.inviteLink}`,
      });
    } catch (err) {
      setBanner({ tone: "error", text: errorMessage(err, "Could not create the login link.") });
    }
  };

  const filteredTeachers = teachersList.filter((teacher) => {
    const q = searchQuery.toLowerCase().trim();
    const haystack = [teacher.name, teacher.subjects, teacher.email, teacher.grades, teacher.location, teacher.qualification, teacher.syllabus]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
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
      <PageHeader
        title={isTeacherView ? "My trainer profile" : "Trainers"}
        description={
          isTeacherView
            ? "Your subjects, classes and availability as the office sees them."
            : "Trainer profiles, subjects, classes, availability and pay rates."
        }
        actions={
          canManage && (
            <>
              <Link
                href="/teachers/import"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-raised"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Import from Google Sheet
              </Link>
              <Button onClick={() => setAddOpen(true)} icon={Plus}>
                Add trainer
              </Button>
            </>
          )
        }
      />

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
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, subject, class, place or email"
                aria-label="Search trainers"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 min-h-[44px]"
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
          <div className="text-xs text-slate-400 font-medium">
            Showing {filteredTeachers.length} of {teachersList.length} trainer{teachersList.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {/* Grid */}
      {filteredTeachers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <GraduationCap className="h-10 w-10 text-slate-400 mx-auto" />
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
                className={`rounded-2xl border bg-slate-900 p-5 sm:p-6 space-y-4 transition-all ${
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
                          className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2.5 py-0.5 text-xs font-bold text-teal-300"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
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
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{teacher.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{teacher.phone}</span>
                  </div>
                  {teacher.location && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span>{teacher.location}</span>
                    </div>
                  )}
                  {(teacher.availableDays || teacher.availableTimes) && (
                    <div className="flex items-start gap-2 text-slate-300">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        Available: {[teacher.availableDays ? formatDays(teacher.availableDays.split(", ")) : null, teacher.availableTimes].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900/90 p-3 text-center text-xs border border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Students</span>
                    <div className="font-extrabold text-white mt-0.5">{teacher.assignedCount}</div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Taught</span>
                    <div className="font-extrabold text-teal-400 mt-0.5">{teacher.taughtCount}</div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Rate/Hr</span>
                    <div className="font-extrabold text-white mt-0.5">
                      {teacher.ratesVisible && teacher.defaultRate !== null ? `₹${teacher.defaultRate}` : "Restricted"}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-slate-300">
                  <span className="font-semibold text-slate-200">Classes:</span> {teacher.grades || "Not set"}
                </div>
                {(teacher.qualification || teacher.syllabus || teacher.devices || teacher.whatsapp || teacher.notes) && (
                  <details className="text-sm text-slate-300">
                    <summary className="min-h-[44px] cursor-pointer content-center font-semibold text-slate-200">More details</summary>
                    <dl className="mt-1 space-y-1">
                      {teacher.qualification && <div><dt className="inline text-slate-400">Qualification: </dt><dd className="inline">{teacher.qualification}</dd></div>}
                      {teacher.syllabus && <div><dt className="inline text-slate-400">Syllabus: </dt><dd className="inline">{teacher.syllabus}</dd></div>}
                      {teacher.devices && <div><dt className="inline text-slate-400">Teaches on: </dt><dd className="inline">{teacher.devices}</dd></div>}
                      {teacher.whatsapp && <div><dt className="inline text-slate-400">WhatsApp: </dt><dd className="inline">{teacher.whatsapp}</dd></div>}
                      {teacher.notes && <div><dt className="inline text-slate-400">Internal notes: </dt><dd className="inline break-words">{teacher.notes}</dd></div>}
                    </dl>
                  </details>
                )}

                {teacher.ratesVisible && teacher.defaultRate !== null && (
                  <div className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-teal-300">
                      <span>Standard Hourly Pay Rates</span>
                      <span className="text-xs text-teal-400/80 font-normal">Per Hour Taught</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                      {RATE_TIERS.map((tier) => (
                        <div key={tier.key} className="rounded-xl bg-slate-900/90 p-1.5 border border-slate-800">
                          <span className="text-slate-400 block font-medium leading-tight">{tier.label}</span>
                          <span className="font-bold text-white">₹{getTierRate(teacher, tier.key)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-slate-400 text-center pt-0.5">
                      Calculation: <span className="font-semibold text-slate-300">Hourly Rate × Class Hours</span>
                    </div>
                  </div>
                )}

                {canManage && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
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
