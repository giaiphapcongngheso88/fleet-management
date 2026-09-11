"use client";

import { EntityListPage } from "@/components/master-data/EntityListPage";
import { CheckboxFormField, TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import Badge from "@/components/ui/badge/Badge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
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
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

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
