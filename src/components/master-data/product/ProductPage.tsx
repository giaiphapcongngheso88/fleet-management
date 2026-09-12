"use client";

import { EntityImportConfig, EntityListPage } from "@/components/master-data/EntityListPage";
import { TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { ImportColumn } from "@/lib/excel/genericImport";
import { productService } from "@/services/master-data";
import { Product } from "@/types/master-data";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(1, "Vui lòng nhập mã hàng hóa"),
  name: z.string().min(1, "Vui lòng nhập tên hàng hóa"),
  unit: z.string().min(1, "Vui lòng nhập đơn vị tính"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = { code: "", name: "", unit: "", note: "" };

const columns: ColumnDef<Product>[] = [
  {
    id: "index",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
    cell: ({ row }) => <div>{row.index + 1}</div>,
  },
  {
    id: "code",
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Mã hàng hóa" />,
    cell: ({ row }) => <div>{row.original.code}</div>,
  },
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tên hàng hóa" />,
    cell: ({ row }) => <div>{row.original.name}</div>,
  },
  {
    id: "unit",
    accessorKey: "unit",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="ĐVT" />,
    cell: ({ row }) => <div>{row.original.unit}</div>,
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

const IMPORT_COLUMNS: ImportColumn<Product>[] = [
  { key: "code", header: "Mã hàng hóa", required: true, example: "HH001" },
  { key: "name", header: "Tên hàng hóa", required: true, example: "Gạch ốp lát" },
  { key: "unit", header: "Đơn vị tính", required: true, example: "Chuyến" },
];

const importConfig: EntityImportConfig<Product> = {
  columns: IMPORT_COLUMNS,
  sheetName: "Hàng hóa",
  templateFileName: "mau-import-hang-hoa.xlsx",
  validateRow: async (raw, rowsSoFar, existingData) => {
    const code = String(raw.code ?? "").trim();
    const name = String(raw.name ?? "").trim();
    const unit = String(raw.unit ?? "").trim();
    const errors: string[] = [];
    if (code) {
      if (existingData.some((p) => p.code.toLowerCase() === code.toLowerCase())) errors.push(`Mã "${code}" đã tồn tại trong hệ thống`);
      else if (rowsSoFar.some((p) => p.code.toLowerCase() === code.toLowerCase())) errors.push(`Mã "${code}" bị trùng trong file`);
    }
    if (errors.length > 0) return { errors };
    return { payload: { code, name, unit, status: "ACTIVE" }, errors: [] };
  },
};

export default function ProductPage() {
  return (
    <EntityListPage<Product, FormValues>
      resourceKey="product"
      entityLabel="Hàng hóa"
      service={productService}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      toFormValues={(item) => ({ code: item.code, name: item.name, unit: item.unit, note: item.note ?? "" })}
      buildCreatePayload={(v) => ({ ...v, status: "ACTIVE" })}
      buildUpdatePayload={(v) => ({ ...v })}
      validate={async (values, mode, editingId) => {
        const dup = await productService.existsByField("code", values.code, editingId);
        return dup ? "Mã hàng hóa đã tồn tại" : null;
      }}
      importConfig={importConfig}
      columns={columns}
      renderForm={(form) => (
        <div className="grid grid-cols-2 gap-3">
          <TextFormField control={form.control} name="code" label="Mã hàng hóa" required />
          <TextFormField control={form.control} name="name" label="Tên hàng hóa" required />
          <TextFormField control={form.control} name="unit" label="Đơn vị tính" required />
          <TextAreaFormField control={form.control} name="note" label="Ghi chú" className="col-span-2" />
        </div>
      )}
    />
  );
}
