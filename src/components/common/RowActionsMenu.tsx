"use client";

import { cn } from "@/app/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReactNode } from "react";

export type RowAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Thao tác có tính phá hủy / ảnh hưởng dữ liệu — hiển thị màu đỏ để người dùng nhận biết. */
  danger?: boolean;
};

/**
 * Menu "..." gom toàn bộ thao tác của một dòng trong bảng, dùng chung cho mọi màn danh sách.
 * Dùng Radix DropdownMenu (cùng hệ quản lý focus/overlay với Dialog ở EntityListPage) — trước đây
 * dùng @heroui/dropdown (nền react-aria) gây xung đột focus với Radix Dialog khi mở form sửa ngay
 * sau khi chọn "Sửa" trong menu, dẫn tới vòng lặp render vô hạn và treo trang.
 */
export function RowActionsMenu({ actions, ariaLabel }: { actions: RowAction[]; ariaLabel: string }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="md" aria-label={ariaLabel}>
            ...
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" aria-label={ariaLabel} className="bg-white dark:bg-gray-800">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.key}
              onSelect={action.onSelect}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap text-sm",
                action.danger ? "text-error-600" : "text-gray-700 dark:text-gray-200"
              )}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
