"use client";

import { StudentFormModal, SubjectOption, TeacherOption } from "./StudentFormModal";

interface AddStudentModalProps {
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (student: any, message: string) => void;
}

export function AddStudentModal(props: AddStudentModalProps) {
  return <StudentFormModal mode="create" {...props} />;
}
