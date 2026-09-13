"use client";
import Image from "next/image";
import React, { useState } from "react";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { signOutUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/utils/permissions";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useCurrentUser();
  const router = useRouter();

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleSignOut = async () => {
    closeDropdown();
    await signOutUser();
    router.push("/signin");
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center text-gray-700 dark:text-gray-400 dropdown-toggle"
      >
        <span className="mr-2 overflow-hidden rounded-full h-9 w-9 bg-brand-100 flex items-center justify-center text-brand-600 font-semibold">
          {user?.avatarUrl ? (
            <Image width={36} height={36} className="h-9 w-9 object-cover" src={user.avatarUrl} alt="User" />
          ) : (
            <span>{(user?.fullName ?? "?").charAt(0).toUpperCase()}</span>
          )}
        </span>

        <span className="hidden sm:block mr-1 font-medium text-theme-sm">{user?.fullName ?? "..."}</span>

        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 z-[120] mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">{user?.fullName}</span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">{user?.email}</span>
          {user?.role && (
            <span className="mt-0.5 block text-theme-xs text-brand-500">{ROLE_LABEL[user.role]}</span>
          )}
        </div>

        <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Hồ sơ cá nhân
            </DropdownItem>
          </li>
        </ul>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          Đăng xuất
        </button>
      </Dropdown>
    </div>
  );
}
