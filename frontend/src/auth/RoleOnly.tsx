import { ReactNode } from "react";
import { UserRole, useAuth } from "./AuthContext";

type RoleOnlyProps = {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function RoleOnly({ roles, children, fallback = null }: RoleOnlyProps) {
  const { hasRole } = useAuth();

  if (!hasRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}