"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { RowAction, RowActionsMenu } from "@/components/common/RowActionsMenu";
import useLoading from "@/components/loading";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeaderSort, DataTable } from "@/components/ui/dataTable";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { useModal } from "@/hooks/useModal";
import { listUsers, setUserStatus } from "@/services/user";
import { AppUser } from "@/types/user";
import { getErrorMessage } from "@/utils/errorHandler";
import { ROLE_LABEL } from "@/utils/permissions";
import { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, Edit, Eye } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CreateUserModal from "./CreateUserModal";
import EditUserModal from "./EditUserModal";

export default function UsersPage() {
  const [data, setData] = useState<AppUser[]>([]);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [viewingOnly, setViewingOnly] = useState(false);
  const { showLoading, hideLoading } = useLoading();
  const { alert, confirm } = useFeedbackDialog();
  const { can } = usePermission();
  const { user: me } = useCurrentUser();
  const createModal = useModal();

  const fetchData = useCallback(async () => {
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      setData(await listUsers());
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy danh sách thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onToggleStatus = async (item: AppUser) => {
    const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const isConfirm = await confirm({
      title: "Xác nhận",
      content: nextStatus === "INACTIVE" ? "Khóa tài khoản này?" : "Mở khóa tài khoản này?",
    });
    if (!isConfirm) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await setUserStatus(item.id, nextStatus, me?.id ?? "");
      await alert({ title: "Thành công", content: "Cập nhật trạng thái thành công" });
      await fetchData();
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Cập nhật thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const columns = useMemo<ColumnDef<AppUser>[]>(
    () => [
      {
        id: "index",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
        cell: ({ row }) => <div>{row.index + 1}</div>,
      },
      {
        id: "fullName",
        accessorKey: "fullName",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Họ tên" />,
        cell: ({ row }) => <div>{row.original.fullName}</div>,
      },
      {
        id: "email",
        accessorKey: "email",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Email" />,
        cell: ({ row }) => <div>{row.original.email}</div>,
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Điện thoại" />,
        cell: ({ row }) => <div>{row.original.phone}</div>,
      },
      {
        id: "role",
        accessorKey: "role",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Vai trò" />,
        cell: ({ row }) => <div>{ROLE_LABEL[row.original.role]}</div>,
        meta: { exportValue: (row) => ROLE_LABEL[row.role] },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="text-xs w-full block text-center">Chức năng</span>,
        cell: ({ row }) => {
          const item = row.original;
          const actions: RowAction[] = [];

          if (can("user", "VIEW")) {
            actions.push({
              key: "view",
              label: "Xem",
              icon: <Eye className="h-4 w-4 text-gray-500" />,
              onSelect: () => {
                setViewingOnly(true);
                setEditing(item);
              },
            });
          }

          if (can("user", "UPDATE")) {
            actions.push({
              key: "edit",
              label: "Sửa thông tin",
              icon: <Edit className="h-4 w-4 text-gray-500" />,
              onSelect: () => {
                setViewingOnly(false);
                setEditing(item);
              },
            });
            actions.push(
              item.status === "ACTIVE"
                ? {
                    key: "lock",
                    label: "Khóa tài khoản",
                    icon: <Ban className="h-4 w-4 text-error-600" />,
                    onSelect: () => onToggleStatus(item),
                    danger: true,
                  }
                : {
                    key: "unlock",
                    label: "Mở khóa tài khoản",
                    icon: <CheckCircle2 className="h-4 w-4 text-success-600" />,
                    onSelect: () => onToggleStatus(item),
                  }
            );
          }

          return <RowActionsMenu ariaLabel="Chức năng người dùng" actions={actions} />;
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <DataTable
          className="h-full w-full overflow-y-auto border"
          tHeadClass="z-40"
          data={data ?? []}
          columns={columns}
          enablePaging
          enableColumnFilter
          enableGlobalFilter
          enableExport
          exportFileName="Nguoi-dung"
          onChange={setData}
        />
      </div>
      <div className="border-t p-2 flex justify-end shrink-0">
        {can("user", "CREATE") && (
          <Button variant="default" onClick={createModal.openModal}>
            Thêm
          </Button>
        )}
      </div>

      {createModal.isOpen && <CreateUserModal onClose={createModal.closeModal} fetchData={fetchData} />}
      {editing && (
        <EditUserModal target={editing} onClose={() => setEditing(null)} fetchData={fetchData} viewOnly={viewingOnly} />
      )}
    </div>
  );
}
