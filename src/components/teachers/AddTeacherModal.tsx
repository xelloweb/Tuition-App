"use client";

import { TeacherFormModal, TeacherFormRecord } from "./TeacherFormModal";

interface AddTeacherModalProps {
  availableSubjects?: { id: string; name: string }[];
  canSetRates: boolean;
  onClose: () => void;
  onSuccess: (teacher: TeacherFormRecord, info: { message: string; warning?: string }) => void;
}

export function AddTeacherModal(props: AddTeacherModalProps) {
  return <TeacherFormModal mode="create" {...props} />;
}
