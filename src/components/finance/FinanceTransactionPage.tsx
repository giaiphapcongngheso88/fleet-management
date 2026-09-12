"use client";

import { CurrencyFormField, DateFormField, SelectFormField, TextAreaFormField } from "@/components/master-data/FormFields";
import { EntityListPage } from "@/components/master-data/EntityListPage";
import { RowAction } from "@/components/common/RowActionsMenu";
import { PrintHeader, PrintSignatureBlock } from "@/components/common/PrintHeader";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DateRange, DateRangeFilter } from "@/components/common/DateRangeFilter";
import Badge from "@/components/ui/badge/Badge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { costTypeService, customerService, driverService, vendorService } from "@/services/master-data";
import { financeTransactionService, generateTransactionNo, getFinanceSummary } from "@/services/finance";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useReferenceData } from "@/hooks/useReferenceData";
import { getCurrentMonthRange } from "@/utils/dateRange";
import { CostType } from "@/types/cost-type";
import { Customer, Driver, Vendor } from "@/types/master-data";
import {
  FinanceTransaction,
  PAYMENT_METHOD_LABEL,
  PaymentMethod,
  TRANSACTION_OBJECT_TYPE_LABEL,
  TRANSACTION_TYPE_LABEL,
  TransactionObjectType,
  TransactionType,
} from "@/types/finance";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);

const TYPE_OPTIONS = (Object.keys(TRANSACTION_TYPE_LABEL) as TransactionType[]).map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABEL[value],
}));

const OBJECT_TYPE_OPTIONS = (Object.keys(TRANSACTION_OBJECT_TYPE_LABEL) as TransactionObjectType[]).map((value) => ({
  value,
  label: TRANSACTION_OBJECT_TYPE_LABEL[value],
}));

const PAYMENT_METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));

const schema = z.object({
  transactionDate: z.string().min(1, "Vui lòng chọn ngày"),
  type: z.enum(["RECEIPT", "PAYMENT"]),
  objectType: z.enum(["CUSTOMER", "VENDOR", "DRIVER", "OTHER"]),
  objectId: z.string().optional(),
  costTypeId: z.string().optional(),
  amount: z.number().positive("Số tiền phải > 0"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
  description: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  transactionDate: today(),
  type: "RECEIPT",
  objectType: "CUSTOMER",
  objectId: "",
  costTypeId: "",
  amount: 0,
  paymentMethod: "CASH",
  description: "",
  note: "",
};

const currencyFormatter = new Intl.NumberFormat("vi-VN");

const PARTY_LABEL_BY_OBJECT_TYPE: Record<TransactionObjectType, string> = {
  CUSTOMER: "Xác nhận của khách hàng",
  VENDOR: "Xác nhận của đơn vị vận tải",
  DRIVER: "Xác nhận của tài xế",
  OTHER: "Xác nhận của người nộp/nhận tiền",
};

export default function FinanceTransactionPage({ title }: { title?: string }) {
  const company = useCompanyInfo();
  const [dateRange, setDateRange] = useState<DateRange>(getCurrentMonthRange());
  const [printingTransaction, setPrintingTransaction] = useState<FinanceTransaction | null>(null);
  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const vendors = useReferenceData<Vendor>(() => vendorService.getAll(), "đơn vị vận tải");
  const drivers = useReferenceData<Driver>(() => driverService.getAll(), "tài xế");
  const costTypes = useReferenceData<CostType>(() => costTypeService.getAll(), "loại chi phí");

  const objectName = (objectType: TransactionObjectType, objectId?: string) => {
    if (!objectId) return objectType === "OTHER" ? "Khác" : "";
    if (objectType === "CUSTOMER") return customers.find((c) => c.id === objectId)?.name ?? "";
    if (objectType === "VENDOR") return vendors.find((v) => v.id === objectId)?.name ?? "";
    if (objectType === "DRIVER") return drivers.find((d) => d.id === objectId)?.name ?? "";
    return "";
  };

  // In phiếu (mục 36) — chờ 1 khung hình để nội dung in ẩn kịp render đúng phiếu vừa chọn rồi mới in,
  // tự dọn state sau khi hộp thoại in đóng lại (dù người dùng in hay hủy) để lần bấm sau luôn đúng.
  useEffect(() => {
    if (!printingTransaction) return;
    const raf = requestAnimationFrame(() => window.print());
    const onAfterPrint = () => setPrintingTransaction(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printingTransaction]);

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` }));
  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.name }));
  const costTypeOptions = costTypes
    .filter((c) => c.isCashTransaction ?? false)
    .map((c) => ({ value: c.id, label: c.name }));

  const columns = useMemo<ColumnDef<FinanceTransaction>[]>(
    () => [
      {
        id: "index",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
        cell: ({ row }) => <div>{row.index + 1}</div>,
      },
      {
        id: "transactionNo",
        accessorKey: "transactionNo",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Mã phiếu" />,
        cell: ({ row }) => <div className="font-medium">{row.original.transactionNo}</div>,
      },
      {
        id: "transactionDate",
        accessorKey: "transactionDate",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Ngày" />,
        cell: ({ row }) => <div>{row.original.transactionDate}</div>,
      },
      {
        id: "type",
        accessorKey: "type",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Loại" />,
        cell: ({ row }) => (
          <Badge color={row.original.type === "RECEIPT" ? "success" : "error"} size="sm">
            {TRANSACTION_TYPE_LABEL[row.original.type]}
          </Badge>
        ),
        meta: { exportValue: (row) => TRANSACTION_TYPE_LABEL[row.type] },
      },
      {
        id: "object",
        header: () => "Đối tượng",
        cell: ({ row }) => <div>{objectName(row.original.objectType, row.original.objectId)}</div>,
        meta: { exportValue: (row) => objectName(row.objectType, row.objectId) },
      },
      {
        id: "amount",
        accessorKey: "amount",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Số tiền" />,
        cell: ({ row }) => <div>{currencyFormatter.format(row.original.amount ?? 0)}</div>,
      },
      {
        id: "paymentMethod",
        header: () => "Phương thức",
        cell: ({ row }) => <div>{PAYMENT_METHOD_LABEL[row.original.paymentMethod]}</div>,
        meta: { exportValue: (row) => PAYMENT_METHOD_LABEL[row.paymentMethod] },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, vendors, drivers]
  );

  return (
    <>
      {printingTransaction && (
        <div className="hidden print:block">
          <PrintHeader title={printingTransaction.type === "RECEIPT" ? "Phiếu thu" : "Phiếu chi"} company={company} />
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="py-1 px-2 font-semibold w-1/3">Số phiếu</td>
                <td className="py-1 px-2">{printingTransaction.transactionNo}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-semibold">Ngày</td>
                <td className="py-1 px-2">{printingTransaction.transactionDate}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-semibold">{TRANSACTION_OBJECT_TYPE_LABEL[printingTransaction.objectType]}</td>
                <td className="py-1 px-2">{objectName(printingTransaction.objectType, printingTransaction.objectId)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-semibold">Số tiền</td>
                <td className="py-1 px-2 font-semibold">{currencyFormatter.format(printingTransaction.amount)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-semibold">Phương thức</td>
                <td className="py-1 px-2">{PAYMENT_METHOD_LABEL[printingTransaction.paymentMethod]}</td>
              </tr>
              {printingTransaction.description && (
                <tr>
                  <td className="py-1 px-2 font-semibold">Nội dung</td>
                  <td className="py-1 px-2">{printingTransaction.description}</td>
                </tr>
              )}
            </tbody>
          </table>
          <PrintSignatureBlock partyLabel={PARTY_LABEL_BY_OBJECT_TYPE[printingTransaction.objectType]} company={company} />
        </div>
      )}

    <EntityListPage<FinanceTransaction, FormValues>
      resourceKey="finance"
      entityLabel="Phiếu thu / chi"
      service={financeTransactionService}
      extraRowActions={(item) => [
        { key: "print", label: "In phiếu", icon: <Printer className="h-4 w-4 text-gray-500" />, onSelect: () => setPrintingTransaction(item) } as RowAction,
      ]}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      dialogClassName="bg-white min-w-[640px] flex flex-col justify-between p-4"
      toFormValues={(item) => ({
        transactionDate: item.transactionDate,
        type: item.type ?? "RECEIPT",
        objectType: item.objectType ?? "CUSTOMER",
        objectId: item.objectId ?? "",
        costTypeId: item.costTypeId ?? "",
        amount: item.amount ?? 0,
        paymentMethod: item.paymentMethod ?? "CASH",
        description: item.description ?? "",
        note: item.note ?? "",
      })}
      buildCreatePayload={async (v) => ({
        transactionNo: await generateTransactionNo(v.type, v.transactionDate),
        transactionDate: v.transactionDate,
        type: v.type,
        objectType: v.objectType,
        objectId: v.objectType === "OTHER" ? undefined : v.objectId || undefined,
        costTypeId: v.costTypeId || undefined,
        amount: v.amount,
        paymentMethod: v.paymentMethod,
        description: v.description || undefined,
        note: v.note || undefined,
        status: "ACTIVE",
      })}
      buildUpdatePayload={(v) => ({
        transactionDate: v.transactionDate,
        type: v.type,
        objectType: v.objectType,
        objectId: v.objectType === "OTHER" ? undefined : v.objectId || undefined,
        costTypeId: v.costTypeId || undefined,
        amount: v.amount,
        paymentMethod: v.paymentMethod,
        description: v.description || undefined,
        note: v.note || undefined,
      })}
      validate={async (values) => {
        if (values.objectType !== "OTHER" && !values.objectId) {
          return "Vui lòng chọn đối tượng thu/chi";
        }
        return null;
      }}
      columns={columns}
      dataFilter={(data) => data.filter((t) => t.transactionDate >= dateRange.from && t.transactionDate <= dateRange.to)}
      renderExtra={(data) => {
        const summary = getFinanceSummary(data);
        return (
          <div className="flex flex-col gap-2 p-2 shrink-0">
            <div className="flex items-center justify-between gap-2 mt-2">
              {title && <h3 className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h3>}
              <div className="shrink-0">
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-[11px] text-gray-400">Tổng thu</p>
                <p className="text-sm sm:text-lg font-semibold text-success-600 truncate">{currencyFormatter.format(summary.totalReceipt)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-[11px] text-gray-400">Tổng chi</p>
                <p className="text-sm sm:text-lg font-semibold text-error-600 truncate">{currencyFormatter.format(summary.totalPayment)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-[11px] text-gray-400">Số dư</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-white/90 truncate">{currencyFormatter.format(summary.balance)}</p>
              </div>
            </div>
          </div>
        );
      }}
      renderForm={(form) => {
        const objectType = form.watch("objectType") ?? "CUSTOMER";
        const objectLabel = TRANSACTION_OBJECT_TYPE_LABEL[objectType] ?? "Đối tượng";
        const objectOptions =
          objectType === "CUSTOMER" ? customerOptions : objectType === "VENDOR" ? vendorOptions : objectType === "DRIVER" ? driverOptions : [];
        return (
          <div className="grid grid-cols-2 gap-3">
            <DateFormField control={form.control} name="transactionDate" label="Ngày" clearable={false} required />
            <SelectFormField control={form.control} name="type" label="Loại phiếu" options={TYPE_OPTIONS} required />
            <SelectFormField
              control={form.control}
              name="objectType"
              label="Đối tượng"
              options={OBJECT_TYPE_OPTIONS}
              required
              onValueChange={() => form.setValue("objectId", "")}
            />
            {objectType !== "OTHER" && (
              <SelectFormField
                control={form.control}
                name="objectId"
                label={objectLabel}
                options={objectOptions}
                placeholder={`Chọn ${objectLabel.toLowerCase()}`}
                required
              />
            )}
            <SelectFormField
              control={form.control}
              name="costTypeId"
              label="Loại thu / chi"
              options={costTypeOptions}
              placeholder="Chọn loại thu/chi (tùy chọn)"
            />
            <CurrencyFormField control={form.control} name="amount" label="Số tiền" required />
            <SelectFormField control={form.control} name="paymentMethod" label="Phương thức" options={PAYMENT_METHOD_OPTIONS} required />
            <TextAreaFormField control={form.control} name="description" label="Nội dung" className="col-span-2" />
            <TextAreaFormField control={form.control} name="note" label="Ghi chú" className="col-span-2" />
          </div>
        );
      }}
    />
    </>
  );
}
