import React from "react";

export default function SidebarWidget() {
  return (
    <div className="mx-auto mb-6 w-full max-w-60 rounded-2xl bg-gray-50 px-4 py-4 text-center dark:bg-white/[0.03]">
      <p className="text-gray-500 text-theme-xs dark:text-gray-400">
        Đại Phát © {new Date().getFullYear()}
      </p>
    </div>
  );
}
