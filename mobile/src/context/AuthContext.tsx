import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { apiRequest, setSessionExpiredHandler, setSessionToken } from "../config/api";

export type StaffRole = "OWNER" | "ADMIN" | "COORDINATOR" | "TRAINER" | null;

export interface AppUser {
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

export interface TrainerProfile {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  teacherId?: string | null;
  assignedStudentsCount?: number;
}

interface AuthContextType {
  role: StaffRole;
  user: AppUser | null;
  trainer: TrainerProfile | null;
  student?: any;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  quickDemo: (demoRole: "ADMIN" | "COORDINATOR" | "TRAINER") => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<StaffRole>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiRequest("/api/mobile/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!data.success) throw new Error(data.message || "Login failed");

      setSessionToken(data.token);
      setToken(data.token);
      setUser(data.user);

      const userRole = data.user.role;
      if (userRole === "TEACHER") {
        setRole("TRAINER");
      } else if (userRole === "OWNER" || userRole === "ADMIN") {
        setRole("ADMIN");
      } else if (userRole === "COORDINATOR") {
        setRole("COORDINATOR");
      } else {
        setRole("ADMIN");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Development builds only (the login screen hides the buttons otherwise): signs in
  // with the local demo accounts. A failed sign-in is shown, never replaced by a fake session.
  const quickDemo = async (demoRole: "ADMIN" | "COORDINATOR" | "TRAINER") => {
    const email =
      demoRole === "TRAINER"
        ? "trainer@xellotuition.com"
        : demoRole === "COORDINATOR"
        ? "coordinator@xellotuition.com"
        : "admin@xellotuition.com";
    await login(email, "demo123");
  };

  const logout = () => {
    setSessionToken(null);
    setRole(null);
    setUser(null);
    setToken(null);
  };

  useEffect(() => {
    setSessionExpiredHandler(() => {
      logout();
      Alert.alert("Please sign in again", "Your session has ended. Sign in again to continue.");
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const trainer: TrainerProfile | null =
    user?.teacher
      ? {
          id: user.teacher.id,
          teacherId: user.teacher.id,
          name: user.teacher.name,
          email: user.teacher.email,
          phone: user.teacher.phone,
          assignedStudentsCount: user.teacher.assignedStudentsCount,
        }
      : user?.teacherId
      ? {
          id: user.teacherId,
          teacherId: user.teacherId,
          name: user.name,
          email: user.email,
        }
      : role === "TRAINER" && user
      ? {
          id: user.id,
          teacherId: user.id,
          name: user.name,
          email: user.email,
        }
      : null;

  return (
    <AuthContext.Provider
      value={{
        role,
        user,
        trainer,
        student: null,
        token,
        isLoading,
        login,
        quickDemo,
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
