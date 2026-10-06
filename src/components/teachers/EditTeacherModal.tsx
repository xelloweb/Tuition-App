"use client";

import { TeacherFormModal, TeacherFormRecord } from "./TeacherFormModal";

interface EditTeacherModalProps {
  teacher: TeacherFormRecord;
  availableSubjects?: { id: string; name: string }[];
  canSetRates: boolean;
  onClose: () => void;
  onSuccess: (teacher: TeacherFormRecord, info: { message: string; warning?: string }) => void;
}

export function EditTeacherModal(props: EditTeacherModalProps) {
  return <TeacherFormModal mode="edit" {...props} />;
}
