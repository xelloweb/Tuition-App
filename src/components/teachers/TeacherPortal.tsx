"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "@/lib/timezones";
import { addDaysToLocalDate, localDateInZone } from "@/lib/zoned-time";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, MessageCircle, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

interface Session {
  id: string;
  student: any;
  subject: any;
  scheduledStartTimeUtc: Date;
  scheduledEndTimeUtc: Date;
  status: string;
  durationMinutes: number;
  attendance?: any;
}

interface TeacherPortalProps {
  teacherName: string;
  sessions: Session[];
  currentDate: string; // YYYY-MM-DD in IST
}

export function TeacherPortal({ teacherName, sessions, currentDate }: TeacherPortalProps) {
  const router = useRouter();

  const handleDateChange = (offset: number) => {
    const nextDate = addDaysToLocalDate(currentDate, offset);
    router.push(`/?date=${nextDate}`);
  };

  const setToday = () => {
    const today = localDateInZone(new Date(), BUSINESS_TIME_ZONE);
    router.push(`/?date=${today}`);
  };

  const isToday = currentDate === localDateInZone(new Date(), BUSINESS_TIME_ZONE);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-black text-white">Welcome, {teacherName}</h2>
        <p className="text-sm text-teal-400 font-bold">My Teaching Operations</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-teal-400" />
              <span className="font-bold text-white text-lg">
                {formatInTimeZone(new Date(currentDate), "Asia/Kolkata", "MMM dd, yyyy")}
              </span>
            </div>
            {!isToday && (
              <button onClick={setToday} className="text-xs text-teal-400 hover:underline mt-1">
                Jump to Today
              </button>
            )}
          </div>

          <button
            onClick={() => handleDateChange(1)}
            className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mt-4 text-center text-xs font-medium text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
          <AlertTriangle className="inline-block h-3.5 w-3.5 mr-1 -mt-0.5" />
          All class timings are in Indian Standard Time (IST).
        </div>
      </div>

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
            <EmptyState
              icon={CalendarIcon}
              title="You have no classes scheduled for this date."
              description="Enjoy your time off or check another date."
            />
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-lg">{session.student.name}</h3>
                  <div className="flex gap-2 items-center mt-1">
                    <span className="text-xs font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                      {session.student.grade} ({session.student.board})
                    </span>
                    <span className="text-xs font-bold bg-teal-500/15 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/30">
                      {session.subject.name}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-white">
                    {formatInTimeZone(session.scheduledStartTimeUtc, "Asia/Kolkata", "HH:mm")} - {formatInTimeZone(session.scheduledEndTimeUtc, "Asia/Kolkata", "HH:mm")}
                  </div>
                  <div className="text-xs text-slate-400">{session.durationMinutes} mins</div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <div className="flex gap-2 items-center">
                  <StatusBadge status={session.status} size="sm" />
                  {session.attendance ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Attendance Submitted
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Attendance Pending
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/attendance?session=${session.id}`}
                    className="text-xs font-bold bg-teal-500 text-slate-950 px-3 py-1.5 rounded-xl hover:bg-teal-400 transition-colors shadow-md"
                  >
                    View Class / Mark Attendance
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
