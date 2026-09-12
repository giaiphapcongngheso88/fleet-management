"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { getRolePermission, resetRolePermission, saveRolePermission } from "@/services/rolePermissions";
import {
  Action,
  ALL_ACTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  EDITABLE_ROLES,
  PERMISSION_RESOURCES,
  PermissionMap,
  RESOURCE_LABEL,
  Role,
  ROLE_LABEL,
} from "@/utils/permissions";
import { getErrorMessage } from "@/utils/errorHandler";
import { useEffect, useState } from "react";

const ACTION_LABEL: Record<Action, string> = {
  VIEW: "Xem",
  CREATE: "Thêm",
  UPDATE: "Sửa",
  DELETE: "Xóa",
  IMPORT: "Import",
  EXPORT: "Export",
  PRINT: "In",
  APPROVE: "Duyệt",
  LOCK: "Chốt",
  UNLOCK: "Mở khóa",
};

export default function RolePermissionsPage() {
  const { alert, confirm } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { user } = useCurrentUser();
  const { reloadOverrides } = usePermission();

  const [role, setRole] = useState<Role>(EDITABLE_ROLES[0]);
  const [permissionMap, setPermissionMap] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);

  const fetchRole = async (r: Role) => {
    setLoading(true);
    try {
      const map = await getRolePermission(r);
      setPermissionMap(map);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Tải quyền thất bại: " + getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRole(role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const isChecked = (resource: string, action: Action) => {
    const actions = permissionMap[resource];
    if (actions === "FULL") return true;
    return Array.isArray(actions) && actions.includes(action);
  };

  const toggle = (resource: string, action: Action, checked: boolean) => {
    setPermissionMap((prev) => {
      const current = prev[resource];
      const actions = new Set(Array.isArray(current) ? current : []);
      if (checked) actions.add(action);
      else actions.delete(action);
      return { ...prev, [resource]: Array.from(actions) };
    });
  };

  const onSave = async () => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await saveRolePermission(role, permissionMap, user?.id ?? "");
      await reloadOverrides();
      await alert({ title: "Thành công", content: `Đã lưu phân quyền cho vai trò "${ROLE_LABEL[role]}".` });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lưu phân quyền thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onReset = async () => {
    const isConfirm = await confirm({
      title: "Xác nhận",
      content: `Khôi phục quyền mặc định cho vai trò "${ROLE_LABEL[role]}"? Các tùy chỉnh riêng đã lưu cho vai trò này sẽ mất.`,
    });
    if (!isConfirm) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await resetRolePermission(role);
      await reloadOverrides();
      setPermissionMap(DEFAULT_ROLE_PERMISSIONS[role]);
      await alert({ title: "Thành công", content: "Đã khôi phục quyền mặc định." });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Khôi phục thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <p className="text-sm text-gray-500">
        Chọn vai trò rồi tick các quyền tương ứng cho từng chức năng. Vai trò <strong>Admin</strong> luôn có toàn quyền, không thể chỉnh sửa.
      </p>

      <div className="flex items-center gap-1 flex-wrap">
        {EDITABLE_ROLES.map((r) => (
          <Button key={r} type="button" size="sm" variant={role === r ? "default" : "outline"} onClick={() => setRole(r)}>
            {ROLE_LABEL[r]}
          </Button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
            <tr>
              <th className="text-left p-2 font-medium sticky left-0 bg-gray-50 dark:bg-gray-800">Chức năng</th>
              {ALL_ACTIONS.map((a) => (
                <th key={a} className="text-center p-2 font-medium whitespace-nowrap">
                  {ACTION_LABEL[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_RESOURCES.map((resource) => (
              <tr key={resource} className="border-t">
                <td className="p-2 font-medium sticky left-0 bg-white dark:bg-gray-900 whitespace-nowrap">
                  {RESOURCE_LABEL[resource] ?? resource}
                </td>
                {ALL_ACTIONS.map((action) => (
                  <td key={action} className="text-center p-2">
                    <Checkbox
                      disabled={loading}
                      checked={isChecked(resource, action)}
                      onCheckedChange={(checked) => toggle(resource, action, checked === true)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={() => void onReset()}>
          Khôi phục mặc định
        </Button>
        <Button type="button" variant="default" onClick={() => void onSave()}>
          Lưu phân quyền
        </Button>
      </div>
    </div>
  );
}
