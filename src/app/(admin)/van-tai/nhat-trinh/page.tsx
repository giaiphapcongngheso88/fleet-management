"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { RowAction, RowActionsMenu } from "@/components/common/RowActionsMenu";
import { DateRange, DateRangeFilter } from "@/components/common/DateRangeFilter";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { TripStatusBadge } from "@/components/trip/TripStatusBadge";
import { usePermission } from "@/context/PermissionContext";
import { useReferenceData } from "@/hooks/useReferenceData";
import { customerService, locationService, vehicleService } from "@/services/master-data";
import { tripService } from "@/services/trip";
import { getCurrentMonthRange } from "@/utils/dateRange";
import { Customer, Location, Vehicle } from "@/types/master-data";
import { Trip } from "@/types/trip";
import { getErrorMessage } from "@/utils/errorHandler";
import { ColumnDef } from "@tanstack/react-table";
import ExcelJS from "exceljs";
import { Download, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export default function TripListPage() {
  const router = useRouter();
  const { can } = usePermission();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const [data, setData] = useState<Trip[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getCurrentMonthRange());

  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const vehicles = useReferenceData<Vehicle>(() => vehicleService.getAll(), "xe");

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "";
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const vehiclePlate = (id: string) => vehicles.find((v) => v.id === id)?.licensePlate ?? "";

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("BẢNG KÊ CHI TIẾT");
    worksheet.mergeCells("A1:J1");
    worksheet.getCell("A1").value = "BẢNG KÊ CHI TIẾT";
    worksheet.getCell("A1").font = { bold: true, size: 14 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };
    worksheet.mergeCells("A2:J2");
    worksheet.getCell("A2").value = `Từ ngày ${dateRange.from} đến ngày ${dateRange.to}`;
    worksheet.getCell("A2").alignment = { horizontal: "center" };
    worksheet.addRow([]);
    worksheet.addRow(["STT", "Mã chuyến", "Ngày", "Khách hàng", "Tuyến", "Xe", "Doanh thu", "Lợi nhuận", "Chênh lệch dầu", "Trạng thái"]);
    const header = worksheet.getRow(4);
    header.font = { bold: true };
    header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    filteredData.forEach((trip, index) => {
      worksheet.addRow([
        index + 1,
        trip.tripCode,
        trip.tripDate,
        customerName(trip.customerId),
        `${locationName(trip.pickupLocationId)} → ${locationName(trip.dropoffLocationId)}`,
        vehiclePlate(trip.vehicleId),
        trip.revenue ?? 0,
        trip.profit ?? 0,
        trip.fuelVarianceAmount ?? 0,
        trip.status,
      ]);
    });
    worksheet.columns = [
      { width: 8 }, { width: 16 }, { width: 14 }, { width: 24 }, { width: 36 },
      { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 },
    ];
    [7, 8, 9].forEach((column) => {
      worksheet.getColumn(column).numFmt = '#,##0';
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bang-ke-chi-tiet-${dateRange.from}-${dateRange.to}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const fetchData = useCallback(async () => {
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const res = await tripService.getAll();
      setData(res);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy danh sách chuyến thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const goToDetail = (trip: Trip) => router.push(`/van-tai/nhat-trinh/${trip.id}`);

  const columns = useMemo<ColumnDef<Trip>[]>(
    () => [
      {
        id: "index",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
        cell: ({ row }) => <div>{row.index + 1}</div>,
      },
      {
        id: "tripCode",
        accessorKey: "tripCode",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Mã chuyến" />,
        cell: ({ row }) => <div className="font-medium">{row.original.tripCode}</div>,
      },
      {
        id: "tripDate",
        accessorKey: "tripDate",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Ngày" />,
        cell: ({ row }) => <div>{row.original.tripDate}</div>,
      },
      {
        id: "customerId",
        header: () => "Khách hàng",
        cell: ({ row }) => <div>{customerName(row.original.customerId)}</div>,
      },
      {
        id: "route",
        header: () => "Tuyến",
        cell: ({ row }) => (
          <div>
            {locationName(row.original.pickupLocationId)} → {locationName(row.original.dropoffLocationId)}
          </div>
        ),
      },
      {
        id: "vehicleId",
        header: () => "Xe",
        cell: ({ row }) => <div>{vehiclePlate(row.original.vehicleId)}</div>,
      },
      {
        id: "revenue",
        accessorKey: "revenue",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Doanh thu" />,
        cell: ({ row }) => <div>{currencyFormatter.format(row.original.revenue ?? 0)}</div>,
      },
      {
        id: "profit",
        accessorKey: "profit",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Lợi nhuận" />,
        cell: ({ row }) => (
          <div className={row.original.profit < 0 ? "text-error-500" : ""}>{currencyFormatter.format(row.original.profit ?? 0)}</div>
        ),
      },
      {
        id: "fuelVarianceAmount",
        accessorKey: "fuelVarianceAmount",
        header: () => "Chênh lệch dầu",
        cell: ({ row }) => {
          const variance = row.original.fuelVarianceAmount ?? 0;
          return <div className={variance > 0 ? "text-error-500 font-medium" : "text-gray-500"}>{currencyFormatter.format(variance)}</div>;
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
        cell: ({ row }) => <TripStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="text-xs w-full block text-center">Chức năng</span>,
        cell: ({ row }) => {
          const actions: RowAction[] = [];
          if (can("trip", "UPDATE") || can("trip", "VIEW")) {
            actions.push({
              key: "edit",
              label: can("trip", "UPDATE") ? "Sửa" : "Xem chi tiết",
              icon: <Edit className="h-4 w-4 text-gray-500" />,
              onSelect: () => goToDetail(row.original),
            });
          }
          return <RowActionsMenu ariaLabel="Chức năng chuyến" actions={actions} />;
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, locations, vehicles, can]
  );

  const filteredData = useMemo(
    () => data.filter((t) => t.tripDate >= dateRange.from && t.tripDate <= dateRange.to),
    [data, dateRange]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 overflow-hidden dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="shrink-0 mb-2 mt-2 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">Nhật trình / Chuyến xe</h3>
        <div className="flex shrink-0 items-center gap-2">
          {can("trip", "EXPORT") && (
            <Button type="button" variant="outline" size="sm" onClick={() => void exportExcel()} className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Xuất Excel
            </Button>
          )}
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
            onChange={setData}
            onRowClick={goToDetail}
          />
        </div>
        <div className="border-t p-2 flex justify-end shrink-0">
          {can("trip", "CREATE") && (
            <Button variant="default" onClick={() => router.push("/van-tai/nhat-trinh/moi")} className="flex items-center gap-2">
              Thêm chuyến
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
