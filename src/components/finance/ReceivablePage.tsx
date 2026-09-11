"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { DateFormField, SelectFormField, TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select/select";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { useModal } from "@/hooks/useModal";
import { useReferenceData } from "@/hooks/useReferenceData";
import { customerService, locationService, productService, vehicleService } from "@/services/master-data";
import {
  computeCustomerReceivable,
  financeTransactionService,
  generateTransactionNo,
  LedgerResult,
  TripLedgerRow,
} from "@/services/finance";
import { Customer, Location, Product, Vehicle } from "@/types/master-data";
import { PAYMENT_METHOD_LABEL, PaymentMethod } from "@/types/finance";
import { getErrorMessage } from "@/utils/errorHandler";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

export default function ReceivablePage() {
  const { can } = usePermission();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { user } = useCurrentUser();
  const { isOpen, openModal, closeModal } = useModal();

  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const vehicles = useReferenceData<Vehicle>(() => vehicleService.getAll(), "xe");
  const products = useReferenceData<Product>(() => productService.getAll(), "hàng hóa");

  const [customerId, setCustomerId] = useState("");
  const [ledger, setLedger] = useState<LedgerResult | null>(null);
  const [payingTripId, setPayingTripId] = useState<string | undefined>(undefined);

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const vehiclePlate = (id: string) => vehicles.find((v) => v.id === id)?.licensePlate ?? "";
  const productName = (id?: string) => products.find((p) => p.id === id)?.name ?? "";

  const canPay = can("receivable", "UPDATE");

  const loadLedger = async (id: string) => {
    setCustomerId(id);
    setLedger(null);
    if (!id) return;
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const result = await computeCustomerReceivable(id);
      setLedger(result);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy công nợ khách hàng thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

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
      const transactionNo = await generateTransactionNo("RECEIPT", values.transactionDate);
      await financeTransactionService.create(
        {
          transactionNo,
          transactionDate: values.transactionDate,
          type: "RECEIPT",
          objectType: "CUSTOMER",
          objectId: customerId,
          tripId: payingTripId,
          amount: values.amount,
          paymentMethod: values.paymentMethod,
          description: values.description || undefined,
          status: "ACTIVE",
        },
        user?.id ?? ""
      );
      await alert({ title: "Thành công", content: `Đã ghi nhận phiếu thu ${transactionNo}` });
      closeModal();
      await loadLedger(customerId);
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
      },
      {
        id: "pickup",
        header: () => "Điểm nâng",
        cell: ({ row }) => <div className="whitespace-nowrap">{locationName(row.original.trip.pickupLocationId)}</div>,
      },
      {
        id: "dropoff",
        header: () => "Điểm hạ",
        cell: ({ row }) => <div className="whitespace-nowrap">{locationName(row.original.trip.dropoffLocationId)}</div>,
      },
      {
        id: "lot",
        header: () => "Lot",
        cell: ({ row }) => <div className="whitespace-nowrap">{row.original.trip.lot}</div>,
      },
      {
        id: "product",
        header: () => "Hàng hóa",
        cell: ({ row }) => <div className="whitespace-nowrap">{productName(row.original.trip.items[0]?.productId)}</div>,
      },
      {
        id: "unit",
        header: () => "ĐVT",
        cell: ({ row }) => <div>{row.original.trip.items[0]?.unit}</div>,
      },
      {
        id: "quantity",
        header: () => "Số lượng",
        cell: ({ row }) => <div className="text-right">{row.original.trip.items[0]?.quantity}</div>,
      },
      {
        id: "unitPrice",
        header: () => "Đơn giá",
        cell: ({ row }) => <div className="text-right whitespace-nowrap">{currencyFormatter.format(row.original.trip.items[0]?.unitPrice ?? 0)}</div>,
      },
      {
        id: "dropFee",
        header: () => "Hạ hàng",
        cell: ({ row }) => <div className="text-right whitespace-nowrap">{currencyFormatter.format(row.original.trip.items[0]?.dropFee ?? 0)}</div>,
      },
      {
        id: "revenue",
        accessorFn: (row) => row.trip.revenue ?? 0,
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tổng thu" />,
        cell: ({ row }) => <div className="text-right whitespace-nowrap font-medium">{currencyFormatter.format(row.original.trip.revenue ?? 0)}</div>,
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
        id: "actions",
        header: () => <span className="text-xs w-full block text-center">Chức năng</span>,
        cell: ({ row }) =>
          canPay && row.original.remaining > 0 ? (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => openPayment(row.original.trip.id)}>
                Thu
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
      <div className="max-w-md">
        <Select
          options={customerOptions}
          value={customerId}
          onChange={(value) => void loadLedger(value)}
          placeholder="Chọn khách hàng để xem công nợ"
          className="w-full"
        />
      </div>

      {ledger && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-xs text-gray-400">Tổng doanh thu (đã hoàn thành)</p>
              <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{currencyFormatter.format(ledger.totalRevenue)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-xs text-gray-400">Đã thu</p>
              <p className="text-lg font-semibold text-success-600">{currencyFormatter.format(ledger.totalPaid)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-xs text-gray-400">Còn lại</p>
              <p className={`text-lg font-semibold ${ledger.balance > 0 ? "text-error-600" : "text-success-600"}`}>
                {currencyFormatter.format(ledger.balance)}
              </p>
            </div>
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
              <Button variant="default" onClick={() => openPayment(undefined)}>
                Ghi nhận thanh toán chung
              </Button>
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
        </>
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
                <DateFormField control={form.control} name="transactionDate" label="Ngày thu" clearable={false} required />
                <TextFormField control={form.control} name="amount" label="Số tiền" type="number" required />
                <SelectFormField control={form.control} name="paymentMethod" label="Phương thức" options={PAYMENT_METHOD_OPTIONS} required />
                <TextAreaFormField control={form.control} name="description" label="Nội dung" />
                <div className="flex justify-end mt-2">
                  <Button type="submit" variant="default">
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
