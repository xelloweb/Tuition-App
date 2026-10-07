"use client";

import { useState } from "react";
import { FileText, CheckCircle2, AlertCircle, Plus, Printer, Star } from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";
import { MobileTabs } from "@/components/ui/MobileTabs";

interface ProgressClientProps {
  progressList: any[];
  assessments: any[];
  concerns: any[];
}

export function ProgressClient({
  progressList,
  assessments,
  concerns,
}: ProgressClientProps) {
  const [activeTab, setActiveTab] = useState<"progress" | "assessments" | "concerns">("progress");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
            <FileText className="h-4 w-4" />
            <span>Academic Growth & Parent Support</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Progress Reports & Assessments
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Subject-wise learning milestones, homework completion tracking, and parent concern tickets.
          </p>
        </div>
      </div>

      {/* Tabs with MobileTabs */}
      <MobileTabs
        tabs={[
          {
            id: "progress",
            label: "Monthly Progress Reviews",
            icon: FileText,
            count: progressList.length,
          },
          {
            id: "assessments",
            label: "Test Assessments",
            icon: Star,
            count: assessments.length,
          },
          {
            id: "concerns",
            label: "Parent Concerns",
            icon: AlertCircle,
            count: concerns.length,
          },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* Tab 1: Monthly Progress */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          {progressList.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-12 text-center text-xs text-slate-400 shadow-xl">
              No monthly progress reviews published yet. Tutors record monthly learning milestones after regular classes.
            </div>
          ) : (
            progressList.map((prog) => (
              <div
                key={prog.id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900 p-6 shadow-xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-white">
                        {prog.student.name}
                      </span>
                      <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 text-xs font-bold text-teal-300">
                        {prog.subject.name}
                      </span>
                      <span className="rounded-lg bg-slate-800 border border-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                        Month: {prog.monthYear}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Trainer: {prog.teacher.name} • Student Grade: {prog.student.grade} ({prog.student.country})
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 self-start sm:self-auto">
                    Homework Completion: {prog.homeworkCompletionRate}%
                  </span>
                </div>

                <div className="text-xs space-y-2 text-slate-300">
                  <div>
                    <strong className="text-white">Curriculum Covered:</strong> {prog.topicProgress}
                  </div>
                  {prog.areasOfImprovement && (
                    <div className="text-amber-300">
                      <strong>Focus Areas for Improvement:</strong> {prog.areasOfImprovement}
                    </div>
                  )}
                  <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-slate-300">
                    <strong className="text-white">Trainer&apos;s evaluation:</strong> {prog.teacherFeedback}
                  </div>
                  {prog.coordinatorNotes && (
                    <div className="text-teal-200 bg-teal-500/5 p-3.5 rounded-2xl border border-teal-500/20">
                      <strong className="text-teal-300">Academic Coordinator Review:</strong> {prog.coordinatorNotes}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Assessments */}
      {activeTab === "assessments" && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 shadow-xl overflow-hidden">
          <div className="divide-y divide-slate-800/80">
            {assessments.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-400">
                No test assessments recorded yet. Test marks and evaluations will appear here.
              </div>
            ) : (
              assessments.map((test) => (
                <div
                  key={test.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {test.assessmentTitle}
                      </span>
                      <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 text-xs font-semibold text-teal-300">
                        {test.subject.name}
                      </span>
                      <span className="text-slate-400">
                        Student: <strong className="text-slate-200">{test.student.name}</strong>
                      </span>
                    </div>
                    <div className="text-slate-400 mt-1">
                      Evaluator: {test.teacher.name} • Date: {formatInTimeZone(test.testDate, "Asia/Kolkata")}
                    </div>
                    {test.feedback && (
                      <div className="text-slate-400 mt-1 italic">
                        &quot;{test.feedback}&quot;
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-bold text-white">
                      {test.score} / {test.maxScore}
                    </div>
                    <div className="text-xs font-bold text-teal-300">
                      {test.percentage}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Parent Concerns */}
      {activeTab === "concerns" && (
        <div className="space-y-4">
          {concerns.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-12 text-center text-xs text-slate-400 shadow-xl">
              No open parent concerns. All student requirements are satisfied!
            </div>
          ) : (
            concerns.map((con) => (
              <div
                key={con.id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900 p-5 shadow-xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      {con.student.name} (Parent Concern)
                    </span>
                    <span className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300">
                      {con.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                        con.status === "RESOLVED"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                      }`}
                    >
                      {con.status}
                    </span>
                  </div>
                  <span className="text-slate-400">
                    {formatInTimeZone(con.reportedDate, "Asia/Kolkata")}
                  </span>
                </div>
                <div className="text-slate-300">
                  <strong className="text-white">Description:</strong> {con.description}
                </div>
                <div className="text-slate-400">
                  Owner: <strong className="text-slate-200">{con.owner}</strong> • Next Action: {con.nextAction || "None"}
                </div>
                {con.resolutionNotes && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-emerald-300">
                    <strong>Resolution:</strong> {con.resolutionNotes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
