"use client";

import { EntityImportConfig, EntityListPage } from "@/components/master-data/EntityListPage";
import { CurrencyFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { ImportColumn } from "@/lib/excel/genericImport";
import { driverService } from "@/services/master-data";
import { Driver } from "@/types/master-data";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên tài xế"),
  phone: z.string().optional(),
  licenseNumber: z.string().optional(),
  citizenId: z.string().optional(),
  baseSalary: z.number().min(0).optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  name: "",
  phone: "",
  licenseNumber: "",
  citizenId: "",
  baseSalary: 0,
  note: "",
};

const currencyFormatter = new Intl.NumberFormat("vi-VN");

const columns: ColumnDef<Driver>[] = [
  {
    id: "index",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
    cell: ({ row }) => <div>{row.index + 1}</div>,
  },
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tên tài xế" />,
    cell: ({ row }) => <div>{row.original.name}</div>,
  },
  {
    id: "phone",
    accessorKey: "phone",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Điện thoại" />,
    cell: ({ row }) => <div>{row.original.phone}</div>,
  },
  {
    id: "licenseNumber",
    accessorKey: "licenseNumber",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="GPLX" />,
    cell: ({ row }) => <div>{row.original.licenseNumber}</div>,
  },
  {
    id: "citizenId",
    accessorKey: "citizenId",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="CCCD" />,
    cell: ({ row }) => <div>{row.original.citizenId}</div>,
  },
  {
    id: "baseSalary",
    accessorKey: "baseSalary",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Lương cơ bản" />,
    cell: ({ row }) => <div>{currencyFormatter.format(row.original.baseSalary ?? 0)}</div>,
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

const IMPORT_COLUMNS: ImportColumn<Driver>[] = [
  { key: "name", header: "Tên tài xế", required: true, example: "Nguyễn Văn A" },
  { key: "phone", header: "Điện thoại", example: "0901234567" },
  { key: "licenseNumber", header: "Số GPLX" },
  { key: "citizenId", header: "Số CCCD" },
  { key: "baseSalary", header: "Lương cơ bản", type: "number", example: 8000000 },
];

const importConfig: EntityImportConfig<Driver> = {
  columns: IMPORT_COLUMNS,
  sheetName: "Tài xế",
  templateFileName: "mau-import-tai-xe.xlsx",
  validateRow: async (raw) => {
    const name = String(raw.name ?? "").trim();
    return {
      payload: {
        name,
        phone: String(raw.phone ?? "") || undefined,
        licenseNumber: String(raw.licenseNumber ?? "") || undefined,
        citizenId: String(raw.citizenId ?? "") || undefined,
        baseSalary: (raw.baseSalary as number | undefined) ?? 0,
        status: "ACTIVE",
      },
      errors: [],
    };
  },
};

export default function DriverPage() {
  return (
    <EntityListPage<Driver, FormValues>
      resourceKey="driver"
      entityLabel="Tài xế"
      service={driverService}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      toFormValues={(item) => ({
        name: item.name,
        phone: item.phone ?? "",
        licenseNumber: item.licenseNumber ?? "",
        citizenId: item.citizenId ?? "",
        baseSalary: item.baseSalary ?? 0,
        note: item.note ?? "",
      })}
      buildCreatePayload={(v) => ({ ...v, status: "ACTIVE" })}
      buildUpdatePayload={(v) => ({ ...v })}
      importConfig={importConfig}
      columns={columns}
      renderForm={(form) => (
        <div className="grid grid-cols-2 gap-3">
          <TextFormField control={form.control} name="name" label="Tên tài xế" required />
          <TextFormField control={form.control} name="phone" label="Điện thoại" />
          <TextFormField control={form.control} name="licenseNumber" label="Số GPLX" />
          <TextFormField control={form.control} name="citizenId" label="Số CCCD" />
          <CurrencyFormField control={form.control} name="baseSalary" label="Lương cơ bản" />
        </div>
      )}
    />
  );
}
