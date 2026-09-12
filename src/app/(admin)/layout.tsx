"use client";

import { LoadingUI } from "@/components/loading";
import { CurrentUserProvider, useCurrentUser } from "@/context/CurrentUserContext";
import { PermissionProvider } from "@/context/PermissionContext";
import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !firebaseUser) {
      router.replace("/signin");
    }
  }, [isLoading, firebaseUser, router]);

  if (isLoading || !firebaseUser) {
    return <LoadingUI />;
  }

  return <>{children}</>;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen ? "ml-0" : isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]";

  return (
    <div className="h-screen print:h-auto xl:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${mainContentMargin} print:ml-0 flex flex-col h-screen print:h-auto overflow-x-hidden print:overflow-visible`}
      >
        <AppHeader />
        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-x-hidden print:overflow-visible p-4 md:p-6 print:p-0">{children}</div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <PermissionProvider>
        <AuthGuard>
          <AdminShell>{children}</AdminShell>
        </AuthGuard>
      </PermissionProvider>
    </CurrentUserProvider>
  );
}
