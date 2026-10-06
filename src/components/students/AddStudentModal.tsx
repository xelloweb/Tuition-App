"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, UserPlus, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { TIMEZONES } from "@/lib/timezones";

interface AddStudentModalProps {
  subjects: any[];
  teachers: any[];
  onClose: () => void;
  onSuccess: (studentId: string) => void;
}

export function AddStudentModal({
  subjects,
  teachers,
  onClose,
  onSuccess,
}: AddStudentModalProps) {
  const router = useRouter();

  // Basic Details
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("10th Grade");
  const [board, setBoard] = useState("CBSE");
  const [medium, setMedium] = useState("English");
  const [guardianName, setGuardianName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("+971 ");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("UAE");
  const [timeZone, setTimeZone] = useState("Asia/Dubai");
  const [preferredTimings, setPreferredTimings] = useState("Weekdays 6:00 PM - 8:00 PM");
  const [learningGoals, setLearningGoals] = useState("");

  // Enrolment & Package
  const [selectedSubject1, setSelectedSubject1] = useState(subjects[0]?.id || "");
  const [selectedTeacher1, setSelectedTeacher1] = useState(teachers[0]?.id || "");
  const [selectedSubject2, setSelectedSubject2] = useState(subjects[1]?.id || "");
  const [selectedTeacher2, setSelectedTeacher2] = useState(teachers[1]?.id || "");

  // Initial Package
  const [createInitialPackage, setCreateInitialPackage] = useState(true);
  const [packageName, setPackageName] = useState("20-Class Multi-Subject Booster");
  const [totalCredits, setTotalCredits] = useState("20");
  const [packagePrice, setPackagePrice] = useState("18000");
  const [allocSub1, setAllocSub1] = useState("10");
  const [allocSub2, setAllocSub2] = useState("10");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCountryChange = (c: string) => {
    setCountry(c);
    if (c === "UAE") {
      setTimeZone("Asia/Dubai");
      if (!whatsappNumber || whatsappNumber === "+91 " || whatsappNumber === "+966 ") {
        setWhatsappNumber("+971 ");
      }
    } else if (c === "Saudi Arabia") {
      setTimeZone("Asia/Riyadh");
      if (!whatsappNumber || whatsappNumber === "+91 " || whatsappNumber === "+971 ") {
        setWhatsappNumber("+966 ");
      }
    } else if (c === "Qatar") {
      setTimeZone("Asia/Qatar");
      setWhatsappNumber("+974 ");
    } else if (c === "India") {
      setTimeZone("Asia/Kolkata");
      setWhatsappNumber("+91 ");
    } else if (c === "Oman") {
      setTimeZone("Asia/Muscat");
      setWhatsappNumber("+968 ");
    } else if (c === "Kuwait") {
      setTimeZone("Asia/Kuwait");
      setWhatsappNumber("+965 ");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const enrolments: any[] = [];
      if (selectedSubject1 && selectedTeacher1) {
        enrolments.push({ subjectId: selectedSubject1, teacherId: selectedTeacher1 });
      }
      if (selectedSubject2 && selectedTeacher2 && selectedSubject2 !== selectedSubject1) {
        enrolments.push({ subjectId: selectedSubject2, teacherId: selectedTeacher2 });
      }

      let initialPackagePayload: any = null;
      if (createInitialPackage) {
        const total = Number(totalCredits);
        const a1 = Number(allocSub1) || 0;
        const a2 = Number(allocSub2) || 0;

        if (a1 + a2 !== total) {
          throw new Error(`Subject allocations (${a1} + ${a2} = ${a1 + a2}) must equal total package credits (${total}).`);
        }

        const allocations = [
          { subjectId: selectedSubject1, allocatedCredits: a1 },
        ];
        if (selectedSubject2 && selectedSubject2 !== selectedSubject1 && a2 > 0) {
          allocations.push({ subjectId: selectedSubject2, allocatedCredits: a2 });
        }

        initialPackagePayload = {
          name: packageName,
          totalCredits: total,
          price: Number(packagePrice) || 0,
          allocations,
        };
      }

      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          grade,
          board,
          medium,
          guardianName,
          whatsappNumber,
          email,
          country,
          timeZone,
          preferredTimings,
          learningGoals,
          enrolments,
          initialPackage: initialPackagePayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add student");
      }

      onSuccess(data.student.id);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Enroll New Student
              </h3>
              <p className="text-xs text-slate-500">
                Create student profile, guardian WhatsApp contact, subject enrolments, and initial package.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5 text-xs">
          {/* Section 1: Student Information */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              1. Student Academic Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Farhan Basheer"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Class / Grade *
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                >
                  <option value="8th Grade">8th Grade</option>
                  <option value="9th Grade">9th Grade</option>
                  <option value="10th Grade">10th Grade</option>
                  <option value="11th Grade">11th Grade</option>
                  <option value="12th Grade">12th Grade</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Curriculum Board *
                </label>
                <select
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                >
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="Kerala State">Kerala State Board</option>
                  <option value="Cambridge IGCSE">Cambridge IGCSE / A-Level</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Medium of Instruction
                </label>
                <select
                  value={medium}
                  onChange={(e) => setMedium(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                >
                  <option value="English">English</option>
                  <option value="Malayalam">Malayalam</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Parent / Guardian & Location */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              2. Guardian & Region (Kerala & GCC)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Parent / Guardian Name *
                </label>
                <input
                  type="text"
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g. Basheer Ahmed"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  WhatsApp Contact (with Country Code) *
                </label>
                <input
                  type="text"
                  required
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Country *
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                >
                  <option value="UAE">🇦🇪 United Arab Emirates</option>
                  <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
                  <option value="Qatar">🇶🇦 Qatar</option>
                  <option value="Oman">🇴🇲 Oman</option>
                  <option value="Kuwait">🇰🇼 Kuwait</option>
                  <option value="India">🇮🇳 India (Kerala)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  IANA Display Timezone *
                </label>
                <select
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Subject Enrolments */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              3. Subject Enrolment & Assigned Tutors
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800">Primary Subject:</span>
                <select
                  value={selectedSubject1}
                  onChange={(e) => setSelectedSubject1(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-slate-900"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                <select
                  value={selectedTeacher1}
                  onChange={(e) => setSelectedTeacher1(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-slate-900"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>Tutor: {t.name}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800">Secondary Subject (Optional):</span>
                <select
                  value={selectedSubject2}
                  onChange={(e) => setSelectedSubject2(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-slate-900"
                >
                  <option value="">None (Single Subject)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                {selectedSubject2 && (
                  <select
                    value={selectedTeacher2}
                    onChange={(e) => setSelectedTeacher2(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-1.5 text-slate-900"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>Tutor: {t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Initial Package Option */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                4. Initial Multi-Subject Package Purchase
              </h4>
              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createInitialPackage}
                  onChange={(e) => setCreateInitialPackage(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                Create Initial Package Now
              </label>
            </div>

            {createInitialPackage && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Package Name
                    </label>
                    <input
                      type="text"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Total Credits
                    </label>
                    <input
                      type="number"
                      value={totalCredits}
                      onChange={(e) => setTotalCredits(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Price (INR)
                    </label>
                    <input
                      type="number"
                      value={packagePrice}
                      onChange={(e) => setPackagePrice(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-teal-200/60 flex items-center gap-4">
                  <span className="text-[11px] font-bold text-slate-700">Initial Split:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">Sub 1:</span>
                    <input
                      type="number"
                      value={allocSub1}
                      onChange={(e) => setAllocSub1(e.target.value)}
                      className="w-16 rounded border border-slate-300 p-1 text-center font-bold"
                    />
                  </div>
                  {selectedSubject2 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">Sub 2:</span>
                      <input
                        type="number"
                        value={allocSub2}
                        onChange={(e) => setAllocSub2(e.target.value)}
                        className="w-16 rounded border border-slate-300 p-1 text-center font-bold"
                      />
                    </div>
                  )}
                  <span className="text-[11px] text-teal-800 ml-auto font-medium">
                    Total: {Number(allocSub1) + Number(allocSub2)} / {totalCredits} Credits
                  </span>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2.5 font-bold text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Registering Student...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Enroll Student
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
