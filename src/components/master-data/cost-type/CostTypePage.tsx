"use client";

import { EntityImportConfig, EntityListPage } from "@/components/master-data/EntityListPage";
import { CheckboxFormField, TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import Badge from "@/components/ui/badge/Badge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { ImportColumn } from "@/lib/excel/genericImport";
import { costTypeService } from "@/services/master-data";
import { CostType } from "@/types/cost-type";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(1, "Vui lòng nhập mã loại chi phí"),
  name: z.string().min(1, "Vui lòng nhập tên loại chi phí"),
  isFuel: z.boolean(),
  isTripCost: z.boolean(),
  isCashTransaction: z.boolean(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  code: "",
  name: "",
  isFuel: false,
  isTripCost: true,
  isCashTransaction: false,
  note: "",
};

const columns: ColumnDef<CostType>[] = [
  {
    id: "index",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
    cell: ({ row }) => <div>{row.index + 1}</div>,
  },
  {
    id: "code",
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Mã" />,
    cell: ({ row }) => <div>{row.original.code}</div>,
  },
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tên loại chi phí" />,
    cell: ({ row }) => <div>{row.original.name}</div>,
  },
  {
    id: "usage",
    header: () => "Dùng cho",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.isFuel && (
          <Badge color="warning" size="sm">
            Nhiên liệu
          </Badge>
        )}
        {(row.original.isTripCost ?? true) && (
          <Badge color="info" size="sm">
            Chi phí chuyến
          </Badge>
        )}
        {(row.original.isCashTransaction ?? false) && (
          <Badge color="success" size="sm">
            Thu - Chi
          </Badge>
        )}
      </div>
    ),
    meta: {
      exportValue: (row) =>
        [row.isFuel && "Nhiên liệu", (row.isTripCost ?? true) && "Chi phí chuyến", (row.isCashTransaction ?? false) && "Thu - Chi"]
          .filter(Boolean)
          .join(", "),
    },
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

const IMPORT_COLUMNS: ImportColumn<CostType>[] = [
  { key: "code", header: "Mã loại chi phí", required: true, example: "CP001" },
  { key: "name", header: "Tên loại chi phí", required: true, example: "Đổ dầu" },
  { key: "isFuel", header: "Nhiên liệu (x = có)", type: "boolean", example: "x" },
  { key: "isTripCost", header: "Chi phí chuyến (x = có)", type: "boolean", example: "x" },
  { key: "isCashTransaction", header: "Thu - Chi (x = có)", type: "boolean" },
];

const importConfig: EntityImportConfig<CostType> = {
  columns: IMPORT_COLUMNS,
  sheetName: "Loại chi phí",
  templateFileName: "mau-import-loai-chi-phi.xlsx",
  validateRow: async (raw, rowsSoFar, existingData) => {
    const code = String(raw.code ?? "").trim();
    const name = String(raw.name ?? "").trim();
    const errors: string[] = [];
    if (code) {
      if (existingData.some((c) => c.code.toLowerCase() === code.toLowerCase())) errors.push(`Mã "${code}" đã tồn tại trong hệ thống`);
      else if (rowsSoFar.some((c) => c.code.toLowerCase() === code.toLowerCase())) errors.push(`Mã "${code}" bị trùng trong file`);
    }
    if (errors.length > 0) return { errors };
    return {
      payload: {
        code,
        name,
        isFuel: Boolean(raw.isFuel),
        isTripCost: Boolean(raw.isTripCost),
        isCashTransaction: Boolean(raw.isCashTransaction),
        status: "ACTIVE",
      },
      errors: [],
    };
  },
};

export default function CostTypePage() {
  return (
    <EntityListPage<CostType, FormValues>
      resourceKey="cost-type"
      entityLabel="Loại chi phí"
      service={costTypeService}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      toFormValues={(item) => ({
        code: item.code,
        name: item.name,
        isFuel: item.isFuel ?? false,
        isTripCost: item.isTripCost ?? true,
        isCashTransaction: item.isCashTransaction ?? false,
        note: item.note ?? "",
      })}
      buildCreatePayload={(v) => ({ ...v, status: "ACTIVE" })}
      buildUpdatePayload={(v) => ({ ...v })}
      validate={async (values, mode, editingId) => {
        const dup = await costTypeService.existsByField("code", values.code, editingId);
        return dup ? "Mã loại chi phí đã tồn tại" : null;
      }}
      importConfig={importConfig}
      columns={columns}
      renderForm={(form) => (
        <div className="grid grid-cols-2 gap-3">
          <TextFormField control={form.control} name="code" label="Mã loại chi phí" required />
          <TextFormField control={form.control} name="name" label="Tên loại chi phí" required />
          <CheckboxFormField control={form.control} name="isFuel" label="Thuộc nhóm nhiên liệu (dầu)" />
          <CheckboxFormField control={form.control} name="isTripCost" label="Dùng làm chi phí chuyến" />
          <CheckboxFormField control={form.control} name="isCashTransaction" label="Dùng làm loại thu / chi" />
          <TextAreaFormField control={form.control} name="note" label="Ghi chú" className="col-span-2" />
        </div>
      )}
    />
  );
}
