/**
 * Builds the admission form's starting values from a parent submission.
 * Staff still check every detail, assign trainers, choose the package and
 * confirm the weekly slots: nothing here books or reserves anything.
 */
import type { StoredSubmission } from "./services/parent-submissions";
import { weekdayName } from "./intake";

/** Same shape as the admission form's draft snapshot (subset). */
export interface AdmissionPrefill {
  version: 1;
  step: "details";
  name: string;
  grade: string;
  board: string;
  medium: string;
  guardianName: string;
  whatsappNumber: string;
  email: string;
  country: string;
  preferredTimings: string;
  learningGoals: string;
  coordinatorNotes: string;
  rows: { key: string; subjectId: string; teacherId: string; credits: string }[];
}

const DEFAULT_TOTAL = 12;
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function admissionPrefill(s: StoredSubmission, reference: string, submittedAtIst: string): AdmissionPrefill {
  const prefs = s.preferences.map((p) => `${p.subjectName} ${weekdayName(p.weekday).slice(0, 3)} ${p.start}–${p.end}`).join("; ");
  const notes = [
    `From parent form ${reference} (submitted ${submittedAtIst} IST).`,
    `Relationship to student: ${s.relationship}.`,
    s.schoolName ? `School: ${s.schoolName}.` : null,
    s.city ? `City: ${s.city}.` : null,
    s.altPhone ? `Alternative number: ${s.altPhone}.` : null,
    s.teachingLanguage ? `Preferred teaching language: ${s.teachingLanguage}.` : null,
    s.startDate ? `Preferred start date: ${s.startDate}.` : null,
    s.notes ? `Parent's notes: ${s.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const n = s.subjects.length;
  return {
    version: 1,
    step: "details",
    name: s.studentName,
    grade: s.grade,
    board: s.board,
    medium: s.medium ?? "English",
    guardianName: s.guardianName,
    whatsappNumber: s.whatsappNumber,
    email: s.email ?? "",
    country: s.country,
    preferredTimings: prefs ? clip(`Parent's preferences (IST, not confirmed): ${prefs}`, 300) : "",
    learningGoals: clip(s.helpAreas ?? "", 1000),
    coordinatorNotes: clip(notes, 2000),
    rows: s.subjects.map((subject, i) => ({
      key: `intake-${subject.id}`,
      subjectId: subject.id,
      teacherId: "",
      credits: String(Math.floor(DEFAULT_TOTAL / n) + (i < DEFAULT_TOTAL % n ? 1 : 0)),
    })),
  };
}
