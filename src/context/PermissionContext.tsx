"use client";

import { loadRolePermissionOverrides } from "@/services/rolePermissions";
import { Action, hasPermission, PermissionMap, Role } from "@/utils/permissions";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "./CurrentUserContext";

type PermissionContextType = {
  can: (resource: string, action: Action) => boolean;
  /** Bảng quyền tùy chỉnh đã tải từ Firestore — true khi tải xong lần đầu (dù rỗng), dùng cho màn hình cấu hình quyền tự refetch. */
  overridesLoaded: boolean;
  reloadOverrides: () => Promise<void>;
};

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  const [overrides, setOverrides] = useState<Partial<Record<Role, PermissionMap>>>({});
  const [overridesLoaded, setOverridesLoaded] = useState(false);

  const reloadOverrides = async () => {
    try {
      const loaded = await loadRolePermissionOverrides();
      setOverrides(loaded);
    } finally {
      setOverridesLoaded(true);
    }
  };

  useEffect(() => {
    void reloadOverrides();
  }, []);

  const can = useMemo(() => {
    return (resource: string, action: Action) => hasPermission(user?.role, resource, action, overrides);
  }, [user?.role, overrides]);

  return <PermissionContext.Provider value={{ can, overridesLoaded, reloadOverrides }}>{children}</PermissionContext.Provider>;
}

export function usePermission() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermission must be used within PermissionProvider");
  }
  return context;
}
