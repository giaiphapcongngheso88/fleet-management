"use client";

import { Action, hasPermission } from "@/utils/permissions";
import { createContext, ReactNode, useContext, useMemo } from "react";
import { useCurrentUser } from "./CurrentUserContext";

type PermissionContextType = {
  can: (resource: string, action: Action) => boolean;
};

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();

  const can = useMemo(() => {
    return (resource: string, action: Action) => hasPermission(user?.role, resource, action);
  }, [user?.role]);

  return <PermissionContext.Provider value={{ can }}>{children}</PermissionContext.Provider>;
}

export function usePermission() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermission must be used within PermissionProvider");
  }
  return context;
}
