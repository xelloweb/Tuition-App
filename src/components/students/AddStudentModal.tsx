"use client";

import type { AdmissionDraftItem } from "@/lib/services/admission-drafts";
import { StudentFormModal, SubjectOption, TeacherOption } from "./StudentFormModal";

interface AddStudentModalProps {
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  /** Resume this admission draft. */
  draft?: AdmissionDraftItem | null;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (student: any, message: string) => void;
  onDraftsChanged?: () => void;
}

export function AddStudentModal(props: AddStudentModalProps) {
  return <StudentFormModal mode="create" {...props} />;
}
