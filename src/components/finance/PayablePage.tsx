"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { PrintHeader, PrintSignatureBlock } from "@/components/common/PrintHeader";
import { CurrencyFormField, DateFormField, SelectFormField, TextAreaFormField } from "@/components/master-data/FormFields";
import { KpiCard } from "@/components/reports/KpiCard";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select/select";
import { InputDatePicker } from "@/components/ui/input-date-picker";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useModal } from "@/hooks/useModal";
import { useReferenceData } from "@/hooks/useReferenceData";
import { locationService, productService, vehicleService, vendorService } from "@/services/master-data";
import {
  computeAllVendorPayables,
  computeVendorPayable,
  financeTransactionService,
  generateTransactionNo,
  LedgerResult,
  TripLedgerRow,
} from "@/services/finance";
import { exportVendorLedgerToExcel, PartnerLedgerItem } from "@/lib/excel/ledgerExport";
import { DebtReconciliationDialog } from "@/components/finance/DebtReconciliationDialog";
import { Location, Product, Vehicle, Vendor } from "@/types/master-data";
import { PAYMENT_METHOD_LABEL, PaymentMethod } from "@/types/finance";
import { getErrorMessage } from "@/utils/errorHandler";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { Download, Landmark, Printer, RefreshCw, Save, TrendingDown, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, parseISO } from "date-fns";

const today = () => new Date().toISOString().slice(0, 10);
const currencyFormatter = new Intl.NumberFormat("vi-VN");

const PAYMENT_METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));

const paymentSchema = z.object({
  transactionDate: z.string().min(1, "Vui lòng chọn ngày"),
  amount: z.number().positive("Số tiền phải > 0"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
  description: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export default function PayablePage() {
  const searchParams = useSearchParams();
  const { can } = usePermission();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { user } = useCurrentUser();
  const { isOpen, openModal, closeModal } = useModal();
  const company = useCompanyInfo();

  const vendors = useReferenceData<Vendor>(() => vendorService.getAll(), "đơn vị vận tải");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const vehicles = useReferenceData<Vehicle>(() => vehicleService.getAll(), "xe");
  const products = useReferenceData<Product>(() => productService.getAll(), "hàng hóa");

  const [vendorId, setVendorId] = useState("");
  const [asOfDate, setAsOfDate] = useState(today());
  const [ledger, setLedger] = useState<LedgerResult | null>(null);
  const [payingTripId, setPayingTripId] = useState<string | undefined>(undefined);

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` }));
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const vehiclePlate = (id: string) => vehicles.find((v) => v.id === id)?.licensePlate ?? "";
  const productName = (id?: string) => products.find((p) => p.id === id)?.name ?? "";
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "";

  const canPay = can("payable", "UPDATE");

  const onExportExcel = async () => {
    if (!ledger || !vendorId) return;
    const currentVendor = vendors.find((v) => v.id === vendorId);
    const item: PartnerLedgerItem = {
      partnerId: vendorId,
      partnerName: currentVendor?.name ?? vendorName(vendorId),
      partnerCode: currentVendor?.code,
      partnerTaxCode: currentVendor?.taxCode,
      partnerAddress: currentVendor?.address,
      partnerPhone: currentVendor?.phone,
      ledger,
    };
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await exportVendorLedgerToExcel({
        items: [item],
        asOfDate,
        onlyPartnerId: vendorId,
        vehiclePlate,
        locationName,
        productName,
      });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Xuất Excel thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onExportAllExcel = async () => {
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
        await alert({ title: "Thông báo", content: "Không có dữ liệu công nợ đơn vị vận tải nào đến ngày đã chọn." });
        return;
      }

      await exportVendorLedgerToExcel({
        items,
        asOfDate,
        vehiclePlate,
        locationName,
        productName,
      });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Xuất Excel tất cả đơn vị vận tải thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const loadLedger = async (id: string, date = asOfDate) => {
    setVendorId(id);
    setLedger(null);
    if (!id) return;
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const result = await computeVendorPayable(id, date);
      setLedger(result);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy công nợ đơn vị vận tải thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const partnerId = searchParams.get("partner") ?? "";
  useEffect(() => {
    if (partnerId && vendors.some((vendor) => vendor.id === partnerId) && vendorId !== partnerId) {
      void loadLedger(partnerId);
    }
    // The URL partner is applied once reference data is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId, vendors, vendorId]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { transactionDate: today(), amount: 0, paymentMethod: "CASH", description: "" },
  });

  const openPayment = (tripId?: string) => {
    setPayingTripId(tripId);
    form.reset({ transactionDate: today(), amount: 0, paymentMethod: "CASH", description: "" });
    openModal();
  };

  const onSubmitPayment = async (values: PaymentFormValues) => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const transactionNo = await generateTransactionNo("PAYMENT", values.transactionDate);
      await financeTransactionService.create(
        {
          transactionNo,
          transactionDate: values.transactionDate,
          type: "PAYMENT",
          objectType: "VENDOR",
          objectId: vendorId,
          tripId: payingTripId,
          amount: values.amount,
          paymentMethod: values.paymentMethod,
          description: values.description || undefined,
          status: "ACTIVE",
        },
        user?.id ?? ""
      );
      await alert({ title: "Thành công", content: `Đã ghi nhận phiếu chi ${transactionNo}` });
      closeModal();
      await loadLedger(vendorId, asOfDate);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Ghi nhận thanh toán thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const columns = useMemo<ColumnDef<TripLedgerRow>[]>(
    () => [
      {
        id: "index",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
        cell: ({ row }) => <div>{row.index + 1}</div>,
      },
      {
        id: "tripDate",
        accessorFn: (row) => row.trip.tripDate,
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Ngày" />,
        cell: ({ row }) => <div className="whitespace-nowrap">{row.original.trip.tripDate}</div>,
      },
      {
        id: "vehicle",
        header: () => "BKS",
        cell: ({ row }) => <div className="whitespace-nowrap">{vehiclePlate(row.original.trip.vehicleId)}</div>,
        meta: { exportValue: (row) => vehiclePlate(row.trip.vehicleId) },
      },
      {
        id: "pickup",
        header: () => "Điểm nâng",
        cell: ({ row }) => <div className="whitespace-nowrap">{locationName(row.original.trip.pickupLocationId)}</div>,
        meta: { exportValue: (row) => locationName(row.trip.pickupLocationId) },
      },
      {
        id: "dropoff",
        header: () => "Điểm hạ",
        cell: ({ row }) => <div className="whitespace-nowrap">{locationName(row.original.trip.dropoffLocationId)}</div>,
        meta: { exportValue: (row) => locationName(row.trip.dropoffLocationId) },
      },
      {
        id: "product",
        header: () => "Hàng hóa",
        cell: ({ row }) => <div className="whitespace-nowrap">{productName(row.original.trip.items[0]?.productId)}</div>,
        meta: { exportValue: (row) => productName(row.trip.items[0]?.productId) },
      },
      {
        id: "unit",
        header: () => "ĐVT",
        cell: ({ row }) => <div>{row.original.trip.items[0]?.unit}</div>,
        meta: { exportValue: (row) => row.trip.items[0]?.unit ?? "" },
      },
      {
        id: "quantity",
        header: () => "Số lượng",
        cell: ({ row }) => <div className="text-right">{row.original.trip.items[0]?.quantity}</div>,
        meta: { exportValue: (row) => row.trip.items[0]?.quantity ?? 0 },
      },
      {
        id: "dropFee",
        header: () => "Hạ hàng",
        cell: ({ row }) => <div className="text-right whitespace-nowrap">{currencyFormatter.format(row.original.trip.items[0]?.dropFee ?? 0)}</div>,
        meta: { exportValue: (row) => row.trip.items[0]?.dropFee ?? 0 },
      },
      {
        id: "vendorCost",
        accessorFn: (row) => row.trip.vendorCost ?? 0,
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Cước thuê" />,
        cell: ({ row }) => <div className="text-right whitespace-nowrap font-medium">{currencyFormatter.format(row.original.trip.vendorCost ?? 0)}</div>,
      },
      {
        id: "paid",
        accessorKey: "paid",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Thanh toán" />,
        cell: ({ row }) => <div className="text-right whitespace-nowrap text-success-600">{currencyFormatter.format(row.original.paid)}</div>,
      },
      {
        id: "remaining",
        accessorKey: "remaining",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Còn lại" />,
        cell: ({ row }) => (
          <div className={`text-right whitespace-nowrap font-medium ${row.original.remaining > 0 ? "text-error-600" : ""}`}>
            {currencyFormatter.format(row.original.remaining)}
          </div>
        ),
      },
      {
        id: "note",
        header: () => "Nội dung",
        cell: ({ row }) => <div className="whitespace-nowrap text-gray-500">{row.original.trip.note}</div>,
        meta: { exportValue: (row) => row.trip.note ?? "" },
      },
      {
        id: "actions",
        header: () => <span className="text-xs w-full block text-center">Chức năng</span>,
        cell: ({ row }) =>
          canPay && row.original.remaining > 0 ? (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => openPayment(row.original.trip.id)} className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Chi
              </Button>
            </div>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations, vehicles, products, canPay]
  );

  return (
    <div className="flex flex-col gap-4">
      {ledger && (
        <div className="hidden print:block">
          <PrintHeader title="Bảng kê công nợ đơn vị vận tải" company={company} />
          <p className="text-sm mb-2">
            <strong>Đơn vị vận tải:</strong> {vendorName(vendorId)}
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-1 px-2">Ngày</th>
                <th className="text-left py-1 px-2">Xe</th>
                <th className="text-left py-1 px-2">Tuyến</th>
                <th className="text-left py-1 px-2">Hàng hóa</th>
                <th className="text-right py-1 px-2">Cước thuê</th>
                <th className="text-right py-1 px-2">Đã trả</th>
                <th className="text-right py-1 px-2">Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((row) => (
                <tr key={row.trip.id} className="border-b border-gray-300">
                  <td className="py-1 px-2">{row.trip.tripDate}</td>
                  <td className="py-1 px-2">{vehiclePlate(row.trip.vehicleId)}</td>
                  <td className="py-1 px-2">
                    {locationName(row.trip.pickupLocationId)} → {locationName(row.trip.dropoffLocationId)}
                  </td>
                  <td className="py-1 px-2">{productName(row.trip.items[0]?.productId)}</td>
                  <td className="text-right py-1 px-2">{currencyFormatter.format(row.trip.vendorCost ?? 0)}</td>
                  <td className="text-right py-1 px-2">{currencyFormatter.format(row.paid)}</td>
                  <td className="text-right py-1 px-2">{currencyFormatter.format(row.remaining)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-semibold">
                <td colSpan={4} className="text-right py-1 px-2">
                  Tổng cộng
                </td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(ledger.totalRevenue)}</td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(ledger.totalPaid)}</td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(ledger.balance)}</td>
              </tr>
            </tfoot>
          </table>
          <PrintSignatureBlock partyLabel="Xác nhận của đơn vị vận tải" company={company} />
        </div>
      )}

      <div className="print:hidden flex flex-wrap items-end gap-2">
        <Select
          options={vendorOptions}
          value={vendorId}
          onChange={(value) => void loadLedger(value)}
          placeholder="Chọn đơn vị vận tải để xem công nợ"
          className="w-80"
        />
        <div className="w-44">
         <Label>Đến ngày</Label>
         <InputDatePicker
           size="md"
           value={asOfDate ? parseISO(asOfDate) : undefined}
           onChange={(date) => {
             const nextDate = date ? format(date, "yyyy-MM-dd") : "";
             setAsOfDate(nextDate);
             if (vendorId) void loadLedger(vendorId, nextDate);
           }}
         />
         </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onExportAllExcel()}
          className="flex items-center gap-1.5 shrink-0"
          title="Xuất Excel toàn bộ đơn vị vận tải có công nợ theo đúng định dạng chứng từ"
        >
          <Download className="h-3.5 w-3.5" /> Xuất tất cả ĐVVT
        </Button>
        {ledger && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5 shrink-0">
              <Printer className="h-3.5 w-3.5" /> In
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadLedger(vendorId, asOfDate)}
              className="flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tải lại</span>
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => void onExportExcel()}
              className="flex items-center gap-1.5 shrink-0"
              title="Xuất Excel bảng kê công nợ cho đơn vị vận tải này"
            >
              <Download className="h-3.5 w-3.5" /> Xuất Excel
            </Button>
          </>
        )}
      </div>

      {ledger && (
        <div className="print:hidden flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard card={{ label: "Tổng cước thuê (đã hoàn thành)", value: ledger.totalRevenue, icon: TrendingDown }} />
            <KpiCard card={{ label: "Đã trả", value: ledger.totalPaid, icon: Wallet, highlight: "success" }} />
            <KpiCard card={{ label: "Còn phải trả", value: ledger.balance, icon: Landmark, highlight: ledger.balance > 0 ? "error" : "success" }} />
          </div>

          <div className="flex items-center justify-between">
            {ledger.unlinkedPayments > 0 ? (
              <p className="text-sm text-gray-500">
                Đã có <span className="font-medium text-success-600">{currencyFormatter.format(ledger.unlinkedPayments)}</span> thanh toán chung
                (không gắn chuyến cụ thể), đã trừ vào tổng công nợ ở trên.
              </p>
            ) : (
              <span />
            )}
            {canPay && (
              <div className="flex flex-wrap justify-end gap-2">
                <DebtReconciliationDialog
                  objectType="VENDOR"
                  objectId={vendorId}
                  partnerName={vendorName(vendorId)}
                  ledger={ledger}
                />
                <Button variant="default" onClick={() => openPayment(undefined)} className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  Ghi nhận thanh toán chung
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col h-[500px]">
            <DataTable
              className="h-full w-full overflow-y-auto border"
              tHeadClass="z-40"
              data={ledger.rows}
              columns={columns}
              enablePaging
              enableColumnFilter
              enableGlobalFilter
            />
          </div>
        </div>
      )}

      {isOpen && (
        <Dialog open={true} onOpenChange={closeModal}>
          <DialogContent className="bg-white min-w-[480px] flex flex-col justify-between p-4">
            <DialogHeader>
              <DialogTitle className="text-md">
                {payingTripId ? "Ghi nhận thanh toán cho chuyến" : "Ghi nhận thanh toán chung"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitPayment)} className="flex flex-col gap-3">
                <DateFormField control={form.control} name="transactionDate" label="Ngày chi" clearable={false} required />
                <CurrencyFormField control={form.control} name="amount" label="Số tiền" required />
                <SelectFormField control={form.control} name="paymentMethod" label="Phương thức" options={PAYMENT_METHOD_OPTIONS} required />
                <TextAreaFormField control={form.control} name="description" label="Nội dung" />
                <div className="flex justify-end mt-2">
                  <Button type="submit" variant="default" className="flex items-center gap-1.5">
                    <Save className="h-4 w-4" />
                    Lưu
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
