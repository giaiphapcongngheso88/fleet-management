"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { RowAction, RowActionsMenu } from "@/components/common/RowActionsMenu";
import useLoading from "@/components/loading";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { usePermission } from "@/context/PermissionContext";
import { computePayrollPeriodTotals, payrollPeriodService } from "@/services/payroll";
import { PayrollPeriod } from "@/types/payroll";
import { getErrorMessage } from "@/utils/errorHandler";
import { ColumnDef } from "@tanstack/react-table";
import { Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export default function PayrollPeriodListPage() {
  const router = useRouter();
  const { can } = usePermission();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const [data, setData] = useState<PayrollPeriod[]>([]);

  const fetchData = useCallback(async () => {
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const res = await payrollPeriodService.getAll();
      setData(res);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy danh sách kỳ lương thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const goToDetail = (period: PayrollPeriod) => router.push(`/tai-chinh/luong-tai-xe/${period.id}`);

  const columns = useMemo<ColumnDef<PayrollPeriod>[]>(
    () => [
      {
        id: "index",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
        cell: ({ row }) => <div>{row.index + 1}</div>,
      },
      {
        id: "periodCode",
        accessorKey: "periodCode",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Kỳ lương" />,
        cell: ({ row }) => <div className="font-medium">{row.original.periodCode}</div>,
      },
      {
        id: "range",
        header: () => "Từ ngày - đến ngày",
        cell: ({ row }) => (
          <div>
            {row.original.fromDate} → {row.original.toDate}
          </div>
        ),
      },
      {
        id: "driverCount",
        header: () => "Số tài xế",
        cell: ({ row }) => <div>{row.original.items.length}</div>,
      },
      {
        id: "totalNet",
        header: () => "Tổng thực nhận",
        cell: ({ row }) => <div>{currencyFormatter.format(computePayrollPeriodTotals(row.original.items).totalNet)}</div>,
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
        cell: ({ row }) => <PayrollStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="text-xs w-full block text-center">Chức năng</span>,
        cell: ({ row }) => {
          const actions: RowAction[] = [];
          if (can("payroll", "VIEW") || can("payroll", "UPDATE")) {
            actions.push({
              key: "detail",
              label: can("payroll", "UPDATE") ? "Sửa" : "Xem chi tiết",
              icon: <Edit className="h-4 w-4 text-gray-500" />,
              onSelect: () => goToDetail(row.original),
            });
          }
          return <RowActionsMenu ariaLabel="Chức năng kỳ lương" actions={actions} />;
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 overflow-hidden dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="shrink-0 mb-2 mt-2 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">Lương tài xế theo kỳ</h3>
      </div>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-1 flex-col h-full overflow-hidden">
          <DataTable
            className="h-full w-full overflow-y-auto border"
            tHeadClass="z-40"
            data={data}
            columns={columns}
            enablePaging
            enableColumnFilter
            enableGlobalFilter
            onChange={setData}
            onRowClick={goToDetail}
          />
        </div>
        <div className="border-t p-2 flex justify-end shrink-0">
          {can("payroll", "CREATE") && (
            <Button variant="default" onClick={() => router.push("/tai-chinh/luong-tai-xe/moi")} className="flex items-center gap-2">
              Tạo kỳ lương mới
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
