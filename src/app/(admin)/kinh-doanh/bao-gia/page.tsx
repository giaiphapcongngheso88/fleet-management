"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { RowAction, RowActionsMenu } from "@/components/common/RowActionsMenu";
import { DateRange, DateRangeFilter } from "@/components/common/DateRangeFilter";
import useLoading from "@/components/loading";
import { QuoteStatusBadge } from "@/components/quote/QuoteStatusBadge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { usePermission } from "@/context/PermissionContext";
import { useReferenceData } from "@/hooks/useReferenceData";
import { customerService } from "@/services/master-data";
import { quoteService } from "@/services/quote";
import { getCurrentMonthRange } from "@/utils/dateRange";
import { Customer } from "@/types/master-data";
import { Quote } from "@/types/quote";
import { getErrorMessage } from "@/utils/errorHandler";
import { ColumnDef } from "@tanstack/react-table";
import { Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export default function QuoteListPage() {
  const router = useRouter();
  const { can } = usePermission();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const [data, setData] = useState<Quote[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getCurrentMonthRange());

  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "";

  const fetchData = useCallback(async () => {
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const res = await quoteService.getAll();
      setData(res);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy danh sách báo giá thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Hiện loading ngay lúc bấm, không tắt ở đây — trang đích tự tắt sau khi tải xong dữ liệu (hoặc
  // tự dọn khi rời trang danh sách này), tránh khoảng trắng giữa lúc bấm và lúc trang đích render.
  const goToDetail = (quote: Quote) => {
    showLoading(ELoadingMessages.LOADING_DATA);
    router.push(`/kinh-doanh/bao-gia/${quote.id}`);
  };

  const columns = useMemo<ColumnDef<Quote>[]>(
    () => [
      {
        id: "index",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
        cell: ({ row }) => <div>{row.index + 1}</div>,
      },
      {
        id: "quoteNo",
        accessorKey: "quoteNo",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Số báo giá" />,
        cell: ({ row }) => <div className="font-medium">{row.original.quoteNo}</div>,
      },
      {
        id: "quoteDate",
        accessorKey: "quoteDate",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Ngày" />,
        cell: ({ row }) => <div>{row.original.quoteDate}</div>,
      },
      {
        id: "customerId",
        header: () => "Khách hàng",
        cell: ({ row }) => <div>{customerName(row.original.customerId)}</div>,
        meta: { exportValue: (row) => customerName(row.customerId) },
      },
      {
        id: "validRange",
        header: () => "Hiệu lực",
        cell: ({ row }) => (
          <div>
            {row.original.validFrom} → {row.original.validTo}
          </div>
        ),
        meta: { exportValue: (row) => `${row.validFrom} -> ${row.validTo}` },
      },
      {
        id: "totalAmount",
        accessorKey: "totalAmount",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tổng tiền" />,
        cell: ({ row }) => <div>{currencyFormatter.format(row.original.totalAmount ?? 0)}</div>,
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
        cell: ({ row }) => <QuoteStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="text-xs w-full block text-center">Chức năng</span>,
        cell: ({ row }) => {
          const actions: RowAction[] = [];
          if (can("quote", "UPDATE") || can("quote", "VIEW")) {
            actions.push({
              key: "edit",
              label: can("quote", "UPDATE") ? "Sửa" : "Xem chi tiết",
              icon: <Edit className="h-4 w-4 text-gray-500" />,
              onSelect: () => goToDetail(row.original),
            });
          }
          return <RowActionsMenu ariaLabel="Chức năng báo giá" actions={actions} />;
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, can]
  );

  const filteredData = useMemo(
    () => data.filter((q) => q.quoteDate >= dateRange.from && q.quoteDate <= dateRange.to),
    [data, dateRange]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 overflow-hidden dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="shrink-0 mb-2 mt-2 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">Báo giá</h3>
        <div className="shrink-0">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-1 flex-col h-full overflow-hidden">
          <DataTable
            className="h-full w-full overflow-y-auto border"
            tHeadClass="z-40"
            data={filteredData}
            columns={columns}
            enablePaging
            enableColumnFilter
            enableGlobalFilter
            enableExport
            exportFileName="Bao-gia"
            onChange={setData}
            onRowClick={goToDetail}
          />
        </div>
        <div className="border-t p-2 flex justify-end shrink-0">
          {can("quote", "CREATE") && (
            <Button
              variant="default"
              onClick={() => {
                showLoading(ELoadingMessages.LOADING_DATA);
                router.push("/kinh-doanh/bao-gia/moi");
              }}
              className="flex items-center gap-2"
            >
              Tạo báo giá
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
