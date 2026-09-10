"use client";

import { cn } from "@/app/lib/utils";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/dropdown";
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
 */
export function RowActionsMenu({ actions, ariaLabel }: { actions: RowAction[]; ariaLabel: string }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex justify-center">
      <Dropdown className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-lg border border-gray-200 dark:border-gray-700 p-1">
        <DropdownTrigger>
          <Button variant="outline" size="md" aria-label={ariaLabel}>
            ...
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label={ariaLabel}>
          {actions.map((action) => (
            <DropdownItem key={action.key} onPress={action.onSelect} textValue={action.label}>
              <div
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap px-1 py-0.5 text-sm",
                  action.danger ? "text-error-600" : "text-gray-700 dark:text-gray-200"
                )}
              >
                {action.icon}
                {action.label}
              </div>
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
