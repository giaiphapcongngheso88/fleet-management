"use client";

import { EntityImportConfig, EntityListPage } from "@/components/master-data/EntityListPage";
import { TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { ImportColumn } from "@/lib/excel/genericImport";
import { vendorService } from "@/services/master-data";
import { Vendor } from "@/types/master-data";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(1, "Vui lòng nhập mã đơn vị vận tải"),
  name: z.string().min(1, "Vui lòng nhập tên đơn vị vận tải"),
  taxCode: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = { code: "", name: "", taxCode: "", address: "", phone: "", note: "" };

const columns: ColumnDef<Vendor>[] = [
  {
    id: "index",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
    cell: ({ row }) => <div>{row.index + 1}</div>,
  },
  {
    id: "code",
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Mã ĐV vận tải" />,
    cell: ({ row }) => <div>{row.original.code}</div>,
  },
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tên đơn vị" />,
    cell: ({ row }) => <div>{row.original.name}</div>,
  },
  {
    id: "taxCode",
    accessorKey: "taxCode",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Mã số thuế" />,
    cell: ({ row }) => <div>{row.original.taxCode}</div>,
  },
  {
    id: "phone",
    accessorKey: "phone",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Điện thoại" />,
    cell: ({ row }) => <div>{row.original.phone}</div>,
  },
  {
    id: "address",
    accessorKey: "address",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Địa chỉ" />,
    cell: ({ row }) => <div className="max-w-[240px] truncate">{row.original.address}</div>,
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

const IMPORT_COLUMNS: ImportColumn<Vendor>[] = [
  { key: "code", header: "Mã ĐV vận tải", required: true, example: "NCC001" },
  { key: "name", header: "Tên đơn vị", required: true, example: "Công ty vận tải XYZ" },
  { key: "taxCode", header: "Mã số thuế", example: "0123456789" },
  { key: "phone", header: "Điện thoại", example: "0901234567" },
  { key: "address", header: "Địa chỉ" },
];

const importConfig: EntityImportConfig<Vendor> = {
  columns: IMPORT_COLUMNS,
  sheetName: "Đơn vị vận tải",
  templateFileName: "mau-import-don-vi-van-tai.xlsx",
  validateRow: async (raw, rowsSoFar, existingData) => {
    const code = String(raw.code ?? "").trim();
    const name = String(raw.name ?? "").trim();
    const errors: string[] = [];
    if (code) {
      if (existingData.some((v) => v.code.toLowerCase() === code.toLowerCase())) errors.push(`Mã "${code}" đã tồn tại trong hệ thống`);
      else if (rowsSoFar.some((v) => v.code.toLowerCase() === code.toLowerCase())) errors.push(`Mã "${code}" bị trùng trong file`);
    }
    if (errors.length > 0) return { errors };
    return {
      payload: {
        code,
        name,
        taxCode: String(raw.taxCode ?? "") || undefined,
        phone: String(raw.phone ?? "") || undefined,
        address: String(raw.address ?? "") || undefined,
        status: "ACTIVE",
      },
      errors: [],
    };
  },
};

export default function VendorPage() {
  return (
    <EntityListPage<Vendor, FormValues>
      resourceKey="vendor"
      entityLabel="Đơn vị vận tải"
      service={vendorService}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      toFormValues={(item) => ({
        code: item.code,
        name: item.name,
        taxCode: item.taxCode ?? "",
        address: item.address ?? "",
        phone: item.phone ?? "",
        note: item.note ?? "",
      })}
      buildCreatePayload={(v) => ({ ...v, status: "ACTIVE" })}
      buildUpdatePayload={(v) => ({ ...v })}
      validate={async (values, mode, editingId) => {
        const dup = await vendorService.existsByField("code", values.code, editingId);
        return dup ? "Mã đơn vị vận tải đã tồn tại" : null;
      }}
      importConfig={importConfig}
      columns={columns}
      renderForm={(form) => (
        <div className="grid grid-cols-2 gap-3">
          <TextFormField control={form.control} name="code" label="Mã ĐV vận tải" required />
          <TextFormField control={form.control} name="name" label="Tên đơn vị" required />
          <TextFormField control={form.control} name="taxCode" label="Mã số thuế" />
          <TextFormField control={form.control} name="phone" label="Điện thoại" />
          <TextAreaFormField control={form.control} name="address" label="Địa chỉ" className="col-span-2" />
          <TextAreaFormField control={form.control} name="note" label="Ghi chú" className="col-span-2" />
        </div>
      )}
    />
  );
}
