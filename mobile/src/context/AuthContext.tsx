import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "../config/api";

export type UserRole = "TRAINER" | "STUDENT" | null;

export interface TrainerUser {
  id: string;
  name: string;
  email: string;
  role: string;
  teacherId?: string | null;
  teacher?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    assignedStudentsCount?: number;
  } | null;
}

export interface StudentUser {
  id: string;
  name: string;
  studentCode: string;
  grade?: string;
  board?: string;
  medium?: string;
  guardianName?: string;
  whatsappNumber?: string;
  country?: string;
  timeZone?: string;
  enrolledSubjects?: Array<{
    subjectId: string;
    subjectName: string;
    subjectColor?: string;
    teacherName?: string;
  }>;
  activePackage?: {
    id: string;
    name: string;
    totalCredits: number;
  } | null;
}

interface AuthContextType {
  role: UserRole;
  trainer: TrainerUser | null;
  student: StudentUser | null;
  token: string | null;
  isLoading: boolean;
  loginTrainer: (email: string, password: string) => Promise<void>;
  loginStudent: (studentCode: string, phone?: string) => Promise<void>;
  quickDemoTrainer: () => Promise<void>;
  quickDemoStudent: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [trainer, setTrainer] = useState<TrainerUser | null>(null);
  const [student, setStudent] = useState<StudentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginTrainer = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiRequest("/api/mobile/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!data.success) throw new Error(data.message || "Login failed");

      setToken(data.token);
      setTrainer(data.user);
      setStudent(null);
      setRole("TRAINER");
    } finally {
      setIsLoading(false);
    }
  };

  const loginStudent = async (studentCode: string, phone?: string) => {
    setIsLoading(true);
    try {
      const data = await apiRequest("/api/mobile/auth/student-login", {
        method: "POST",
        body: JSON.stringify({ studentCode, phone }),
      });

      if (!data.success) throw new Error(data.message || "Student login failed");

      setToken(data.token);
      setStudent(data.student);
      setTrainer(null);
      setRole("STUDENT");
    } finally {
      setIsLoading(false);
    }
  };

  // Instant demo access for previewing Trainer experience
  const quickDemoTrainer = async () => {
    setIsLoading(true);
    try {
      // First try live endpoint or set demo state
      try {
        await loginTrainer("trainer@xellotuition.com", "demo123");
        return;
      } catch (e) {
        // Fallback to local demo trainer
        setToken("demo-trainer-token");
        setTrainer({
          id: "demo-trainer-user",
          name: "Sumi Varghese",
          email: "trainer@xello.com",
          role: "TEACHER",
          teacherId: "demo-trainer-id",
          teacher: {
            id: "demo-trainer-id",
            name: "Sumi Varghese",
            email: "trainer@xello.com",
            phone: "+91 9847000000",
            assignedStudentsCount: 6,
          },
        });
        setStudent(null);
        setRole("TRAINER");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Instant demo access for previewing Student / Parent experience
  const quickDemoStudent = async () => {
    setIsLoading(true);
    try {
      try {
        await loginStudent("XST-131");
        return;
      } catch (e) {
        // Fallback to local demo student
        setToken("demo-student-token");
        setStudent({
          id: "demo-student-id",
          name: "Slaine",
          studentCode: "XST-131",
          grade: "10th Grade",
          board: "CBSE",
          medium: "English",
          guardianName: "Parent of Slaine",
          whatsappNumber: "+965 9446511500",
          country: "Kuwait",
          timeZone: "Asia/Kuwait",
          enrolledSubjects: [
            { subjectId: "sub-1", subjectName: "Mathematics", subjectColor: "#14b8a6", teacherName: "Sumi Varghese" },
            { subjectId: "sub-2", subjectName: "Science", subjectColor: "#6366f1", teacherName: "Anu George" },
          ],
          activePackage: {
            id: "pkg-1",
            name: "12 Classes - Monthly Package",
            totalCredits: 12,
          },
        });
        setTrainer(null);
        setRole("STUDENT");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setRole(null);
    setTrainer(null);
    setStudent(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        trainer,
        student,
        token,
        isLoading,
        loginTrainer,
        loginStudent,
        quickDemoTrainer,
        quickDemoStudent,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
