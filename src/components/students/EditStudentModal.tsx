"use client";

import { StudentFormModal, StudentFormRecord, SubjectOption, TeacherOption } from "./StudentFormModal";

interface EditStudentModalProps {
  student: StudentFormRecord;
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (student: any, message: string) => void;
}

export function EditStudentModal(props: EditStudentModalProps) {
  return <StudentFormModal mode="edit" {...props} />;
}
