"use client";

import CompanyInfoPage from "@/components/settings/CompanyInfoPage";
import { useCurrentUser } from "@/context/CurrentUserContext";

export default function Page() {
  const { user } = useCurrentUser();

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 overflow-y-auto dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="shrink-0 text-lg font-semibold text-gray-800 dark:text-white/90 mb-2 mt-2">Thông tin công ty</h3>
      {user && user.role !== "ADMIN" ? (
        <p className="text-sm text-error-500">Chỉ Admin mới được cấu hình thông tin công ty.</p>
      ) : (
        <CompanyInfoPage />
      )}
    </div>
  );
}
