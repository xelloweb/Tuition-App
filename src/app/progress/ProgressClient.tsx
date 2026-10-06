"use client";

import { useState } from "react";
import { FileText, CheckCircle2, AlertCircle, Plus, Printer, Star } from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";

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
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <FileText className="h-4 w-4" />
            <span>Academic Growth & Parent Support</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Progress Reports & Assessments
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Subject-wise learning milestones, homework completion tracking, and parent concern tickets.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("progress")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "progress"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="h-4 w-4" />
          Monthly Progress Reviews ({progressList.length})
        </button>
        <button
          onClick={() => setActiveTab("assessments")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "assessments"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Star className="h-4 w-4" />
          Test Assessments ({assessments.length})
        </button>
        <button
          onClick={() => setActiveTab("concerns")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "concerns"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Parent Concerns ({concerns.length})
        </button>
      </div>

      {/* Tab 1: Monthly Progress */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          {progressList.map((prog) => (
            <div
              key={prog.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900">
                      {prog.student.name}
                    </span>
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700">
                      {prog.subject.name}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      Month: {prog.monthYear}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Tutor: {prog.teacher.name} • Student Grade: {prog.student.grade} ({prog.student.country})
                  </div>
                </div>

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 self-start sm:self-auto">
                  Homework Completion: {prog.homeworkCompletionRate}%
                </span>
              </div>

              <div className="text-xs space-y-2 text-slate-700">
                <div>
                  <strong className="text-slate-900">Curriculum Covered:</strong> {prog.topicProgress}
                </div>
                {prog.areasOfImprovement && (
                  <div className="text-amber-800">
                    <strong>Focus Areas for Improvement:</strong> {prog.areasOfImprovement}
                  </div>
                )}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-600">
                  <strong className="text-slate-900">Teacher's Evaluation:</strong> {prog.teacherFeedback}
                </div>
                {prog.coordinatorNotes && (
                  <div className="text-teal-800 bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                    <strong className="text-teal-900">Academic Coordinator Review:</strong> {prog.coordinatorNotes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Assessments */}
      {activeTab === "assessments" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {assessments.map((test) => (
              <div
                key={test.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {test.assessmentTitle}
                    </span>
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                      {test.subject.name}
                    </span>
                    <span className="text-slate-500">
                      Student: <strong>{test.student.name}</strong>
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1">
                    Evaluator: {test.teacher.name} • Date: {formatInTimeZone(test.testDate, "Asia/Kolkata")}
                  </div>
                  {test.feedback && (
                    <div className="text-slate-600 mt-1 italic">
                      "{test.feedback}"
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-black text-slate-900">
                    {test.score} / {test.maxScore}
                  </div>
                  <div className="text-xs font-bold text-teal-700">
                    {test.percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Parent Concerns */}
      {activeTab === "concerns" && (
        <div className="space-y-4">
          {concerns.map((con) => (
            <div
              key={con.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    {con.student.name} (Parent Concern)
                  </span>
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                    {con.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      con.status === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {con.status}
                  </span>
                </div>
                <span className="text-slate-400">
                  {formatInTimeZone(con.reportedDate, "Asia/Kolkata")}
                </span>
              </div>
              <div className="text-slate-700">
                <strong>Description:</strong> {con.description}
              </div>
              <div className="text-slate-500">
                Owner: <strong>{con.owner}</strong> • Next Action: {con.nextAction || "None"}
              </div>
              {con.resolutionNotes && (
                <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 text-emerald-800">
                  <strong>Resolution:</strong> {con.resolutionNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
