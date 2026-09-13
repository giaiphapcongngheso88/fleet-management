"use client";

import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { InputDatePicker } from "@/components/ui/input-date-picker";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import useLoading from "@/components/loading";
import { ELoadingMessages } from "@/app/lib/enums";
import {
  customerService,
  locationService,
  productService,
  vehicleService,
  vendorService,
} from "@/services/master-data";
import {
  computeAllCustomerReceivables,
  computeAllVendorPayables,
  computeCustomerReceivable,
  computeDebtSummary,
  computeVendorPayable,
  DebtSummaryRow,
} from "@/services/finance";
import {
  exportCustomerLedgerToExcel,
  exportVendorLedgerToExcel,
  PartnerLedgerItem,
} from "@/lib/excel/ledgerExport";
import { Customer, Location, Product, Vehicle, Vendor } from "@/types/master-data";
import { getErrorMessage } from "@/utils/errorHandler";
import { useReferenceData } from "@/hooks/useReferenceData";
import { usePermission } from "@/context/PermissionContext";
import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Download, RefreshCw } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const currencyFormatter = new Intl.NumberFormat("vi-VN");

export default function DebtSummaryPage() {
  const router = useRouter();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { can } = usePermission();

  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const vendors = useReferenceData<Vendor>(() => vendorService.getAll(), "đơn vị vận tải");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const vehicles = useReferenceData<Vehicle>(() => vehicleService.getAll(), "xe");
  const products = useReferenceData<Product>(() => productService.getAll(), "hàng hóa");

  const [asOfDate, setAsOfDate] = useState(today());
  const [rows, setRows] = useState<DebtSummaryRow[]>([]);

  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const vehiclePlate = (id: string) => vehicles.find((v) => v.id === id)?.licensePlate ?? "";
  const productName = (id?: string) => products.find((p) => p.id === id)?.name ?? "";

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

  const onExportSinglePartner = async (row: DebtSummaryRow) => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      if (row.objectType === "CUSTOMER") {
        const ledger = await computeCustomerReceivable(row.objectId, asOfDate);
        const customer = customers.find((c) => c.id === row.objectId);
        const item: PartnerLedgerItem = {
          partnerId: row.objectId,
          partnerName: customer?.name ?? row.partnerName,
          partnerCode: customer?.code,
          partnerTaxCode: customer?.taxCode,
          partnerAddress: customer?.address,
          partnerPhone: customer?.phone,
          ledger,
        };
        await exportCustomerLedgerToExcel({
          items: [item],
          asOfDate,
          onlyPartnerId: row.objectId,
          vehiclePlate,
          locationName,
          productName,
        });
      } else {
        const ledger = await computeVendorPayable(row.objectId, asOfDate);
        const vendor = vendors.find((v) => v.id === row.objectId);
        const item: PartnerLedgerItem = {
          partnerId: row.objectId,
          partnerName: vendor?.name ?? row.partnerName,
          partnerCode: vendor?.code,
          partnerTaxCode: vendor?.taxCode,
          partnerAddress: vendor?.address,
          partnerPhone: vendor?.phone,
          ledger,
        };
        await exportVendorLedgerToExcel({
          items: [item],
          asOfDate,
          onlyPartnerId: row.objectId,
          vehiclePlate,
          locationName,
          productName,
        });
      }
    } catch (error: unknown) {
      await alert({ title: "Lỗi", content: "Xuất Excel thất bại: " + getErrorMessage(error) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onExportAllCustomers = async () => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const allLedgers = await computeAllCustomerReceivables(asOfDate);
      const items: PartnerLedgerItem[] = [];
      for (const customer of customers) {
        const customerLedger = allLedgers.get(customer.id);
        if (customerLedger && (customerLedger.rows.length > 0 || customerLedger.unlinkedPayments > 0)) {
          items.push({
            partnerId: customer.id,
            partnerName: customer.name,
            partnerCode: customer.code,
            partnerTaxCode: customer.taxCode,
            partnerAddress: customer.address,
            partnerPhone: customer.phone,
            ledger: customerLedger,
          });
        }
      }
      if (items.length === 0) {
        await alert({ title: "Thông báo", content: "Không có dữ liệu công nợ khách hàng nào." });
        return;
      }
      await exportCustomerLedgerToExcel({
        items,
        asOfDate,
        vehiclePlate,
        locationName,
        productName,
      });
    } catch (error: unknown) {
      await alert({ title: "Lỗi", content: "Xuất Excel thất bại: " + getErrorMessage(error) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onExportAllVendors = async () => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const allLedgers = await computeAllVendorPayables(asOfDate);
      const items: PartnerLedgerItem[] = [];
      for (const vendor of vendors) {
        const vendorLedger = allLedgers.get(vendor.id);
        if (vendorLedger && (vendorLedger.rows.length > 0 || vendorLedger.unlinkedPayments > 0)) {
          items.push({
            partnerId: vendor.id,
            partnerName: vendor.name,
            partnerCode: vendor.code,
            partnerTaxCode: vendor.taxCode,
            partnerAddress: vendor.address,
            partnerPhone: vendor.phone,
            ledger: vendorLedger,
          });
        }
      }
      if (items.length === 0) {
        await alert({ title: "Thông báo", content: "Không có dữ liệu công nợ đơn vị vận tải nào." });
        return;
      }
      await exportVendorLedgerToExcel({
        items,
        asOfDate,
        vehiclePlate,
        locationName,
        productName,
      });
    } catch (error: unknown) {
      await alert({ title: "Lỗi", content: "Xuất Excel thất bại: " + getErrorMessage(error) });
    } finally {
      hideLoading(loadingId);
    }
  };

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
      cell: ({ row }) => {
        const canView = can(row.original.objectType === "CUSTOMER" ? "receivable" : "payable", "VIEW");
        if (!canView) return null;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(row.original.objectType === "CUSTOMER" ? `/cong-no/khach-hang?partner=${row.original.objectId}` : `/cong-no/don-vi-van-tai?partner=${row.original.objectId}`)}
            >
              Xem
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void onExportSinglePartner(row.original)}
              title="Xuất Excel bảng kê công nợ đối tác này"
              className="flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
          </div>
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [can, router, customers, vendors, asOfDate, locations, vehicles, products]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <label className="text-sm font-medium">Đến ngày</label>
          <InputDatePicker size="md" value={asOfDate ? parseISO(asOfDate) : undefined} onChange={(date) => setAsOfDate(date ? format(date, "yyyy-MM-dd") : "")} />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Tải lại</Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onExportAllCustomers()}
          className="flex items-center gap-1.5"
          title="Xuất Excel toàn bộ công nợ khách hàng (mỗi khách hàng một dải nổi bật + bảng chi tiết)"
        >
          <Download className="h-3.5 w-3.5" /> Xuất Excel KH
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onExportAllVendors()}
          className="flex items-center gap-1.5"
          title="Xuất Excel toàn bộ công nợ đơn vị vận tải (mỗi ĐVVT một dải nổi bật + bảng chi tiết)"
        >
          <Download className="h-3.5 w-3.5" /> Xuất Excel ĐVVT
        </Button>
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
        />
      </div>
    </div>
  );
}
