import React, { createContext, useContext, useMemo, useState } from "react";

export type UserRole = "INSPECTOR" | "SUPERVISOR" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  token: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "inspecapp.auth.user";

function getApiUrl() {
  const base = import.meta.env.VITE_API_URL || "http://localhost:3001";
  return base.replace(/\/+$/, "");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return null;
    }

    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });

  async function login(email: string, password: string) {
    const response = await fetch(`${getApiUrl()}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(
        data.message || data.error || `No se pudo iniciar sesión (HTTP ${response.status})`
      );
    }

    const nextUser: AuthUser = {
      ...data.user,
      token: data.token
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  function hasRole(roles: UserRole[]) {
    if (!user) return false;
    return roles.includes(user.role);
  }

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      hasRole
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}