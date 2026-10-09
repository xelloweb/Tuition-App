import React, { createContext, useContext, useState } from "react";
import { apiRequest } from "../config/api";

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

interface AuthContextType {
  role: StaffRole;
  user: AppUser | null;
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

  const quickDemo = async (demoRole: "ADMIN" | "COORDINATOR" | "TRAINER") => {
    setIsLoading(true);
    try {
      if (demoRole === "TRAINER") {
        try {
          await login("trainer@xellotuition.com", "demo123");
          return;
        } catch (e) {
          setToken("demo-trainer-token");
          setUser({
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
          setRole("TRAINER");
        }
      } else if (demoRole === "COORDINATOR") {
        try {
          await login("coordinator@xellotuition.com", "demo123");
          return;
        } catch (e) {
          setToken("demo-coord-token");
          setUser({
            id: "demo-coord-user",
            name: "Aisha Nair",
            email: "coordinator@xellotuition.com",
            role: "COORDINATOR",
          });
          setRole("COORDINATOR");
        }
      } else {
        try {
          await login("admin@xellotuition.com", "demo123");
          return;
        } catch (e) {
          setToken("demo-admin-token");
          setUser({
            id: "demo-admin-user",
            name: "Shamrood",
            email: "admin@xellotuition.com",
            role: "OWNER",
          });
          setRole("ADMIN");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setRole(null);
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        user,
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
