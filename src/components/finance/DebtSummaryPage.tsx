"use client";

import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { KpiCard } from "@/components/reports/KpiCard";
import { InputDatePicker } from "@/components/ui/input-date-picker";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import useLoading from "@/components/loading";
import { ELoadingMessages } from "@/app/lib/enums";
import { customerService, vendorService } from "@/services/master-data";
import { computeDebtSummary, DebtSummaryRow } from "@/services/finance";
import { Customer, Vendor } from "@/types/master-data";
import { getErrorMessage } from "@/utils/errorHandler";
import { useReferenceData } from "@/hooks/useReferenceData";
import { usePermission } from "@/context/PermissionContext";
import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, HandCoins, Landmark, RefreshCw, Wallet } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const currencyFormatter = new Intl.NumberFormat("vi-VN");

export default function DebtSummaryPage() {
  const router = useRouter();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { can } = usePermission();
  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const vendors = useReferenceData<Vendor>(() => vendorService.getAll(), "đơn vị vận tải");
  const [asOfDate, setAsOfDate] = useState(today());
  const [rows, setRows] = useState<DebtSummaryRow[]>([]);

  const load = useCallback(async (date = asOfDate) => {
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      setRows(await computeDebtSummary(date));
    } catch (error: unknown) {
      await alert({ title: "Lỗi", content: "Lấy tổng hợp công nợ thất bại: " + getErrorMessage(error) });
    } finally {
      hideLoading(loadingId);
    }
  }, [alert, asOfDate, hideLoading, showLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const data = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        partnerName:
          row.objectType === "CUSTOMER"
            ? customers.find((item) => item.id === row.objectId)?.name ?? row.partnerName
            : vendors.find((item) => item.id === row.objectId)?.name ?? row.partnerName,
      })),
    [rows, customers, vendors]
  );
  const columns = useMemo<ColumnDef<DebtSummaryRow>[]>(() => [
    { id: "partnerName", accessorKey: "partnerName", header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Đối tác" /> },
    {
      id: "objectType",
      accessorKey: "objectType",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Loại" />,
      cell: ({ row }) => row.original.objectType === "CUSTOMER" ? "Khách hàng" : "Đơn vị vận tải",
      meta: { exportValue: (row) => row.objectType === "CUSTOMER" ? "Khách hàng" : "Đơn vị vận tải" },
    },
    { id: "incurred", accessorKey: "incurred", header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Phát sinh" />, cell: ({ row }) => currencyFormatter.format(row.original.incurred) },
    { id: "paid", accessorKey: "paid", header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Đã thu/chi" />, cell: ({ row }) => currencyFormatter.format(row.original.paid) },
    { id: "balance", accessorKey: "balance", header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Còn lại" />, cell: ({ row }) => <span className={row.original.balance > 0 ? "font-semibold text-error-600" : "text-success-600"}>{currencyFormatter.format(row.original.balance)}</span> },
    {
      id: "actions",
      header: () => "Chi tiết",
      cell: ({ row }) => can(row.original.objectType === "CUSTOMER" ? "receivable" : "payable", "VIEW") ? (
        <Button size="sm" variant="outline" onClick={() => router.push(row.original.objectType === "CUSTOMER" ? `/cong-no/khach-hang?partner=${row.original.objectId}` : `/cong-no/don-vi-van-tai?partner=${row.original.objectId}`)} className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          Xem
        </Button>
      ) : null,
    },
  ], [can, router]);
  const totals = useMemo(
    () => data.reduce(
      (summary, row) => ({
        incurred: summary.incurred + row.incurred,
        paid: summary.paid + row.paid,
        balance: summary.balance + row.balance,
      }),
      { incurred: 0, paid: 0, balance: 0 }
    ),
    [data]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-3 rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard card={{ label: "Tổng phát sinh", value: totals.incurred, icon: Landmark }} />
        <KpiCard card={{ label: "Đã thu / chi", value: totals.paid, icon: Wallet, highlight: "success" }} />
        <KpiCard card={{ label: "Còn lại", value: totals.balance, icon: HandCoins, highlight: totals.balance > 0 ? "error" : "success" }} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <label className="text-sm font-medium">Đến ngày</label>
          <InputDatePicker size="md" value={asOfDate ? parseISO(asOfDate) : undefined} onChange={(date) => setAsOfDate(date ? format(date, "yyyy-MM-dd") : "")} />
        </div>
        <Button variant="outline" onClick={() => void load()} className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Tải lại</Button>
      </div>
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <DataTable
          className="h-full w-full overflow-y-auto border"
          tHeadClass="z-40"
          data={data}
          columns={columns}
          enablePaging
          enableColumnFilter
          enableGlobalFilter
          enableExport
          exportFileName="Tong-hop-cong-no"
        />
      </div>
    </div>
  );
}
