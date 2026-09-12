"use client";

import { EntityListPage } from "@/components/master-data/EntityListPage";
import { TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { BaseEntity } from "@/types/common";
import { paymentMethodService, unitOfMeasureService } from "@/services/master-data";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

export interface CatalogItem extends BaseEntity {
  code: string;
  name: string;
}

const schema = z.object({
  code: z.string().min(1, "Vui lòng nhập mã"),
  name: z.string().min(1, "Vui lòng nhập tên"),
});

type FormValues = z.infer<typeof schema>;

export default function CatalogPage({
  entityLabel,
  resourceKey,
}: {
  entityLabel: string;
  resourceKey: "unit" | "payment-method";
}) {
  const service = resourceKey === "unit" ? unitOfMeasureService : paymentMethodService;
  const columns: ColumnDef<CatalogItem>[] = [
    { id: "index", header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />, cell: ({ row }) => row.index + 1 },
    { id: "code", accessorKey: "code", header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Mã" /> },
    { id: "name", accessorKey: "name", header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tên" /> },
    { id: "status", accessorKey: "status", header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ];

  return (
    <EntityListPage<CatalogItem, FormValues>
      resourceKey={resourceKey}
      entityLabel={entityLabel}
      service={service}
      resolver={zodResolver(schema)}
      defaultValues={{ code: "", name: "" }}
      toFormValues={(item) => ({ code: item.code, name: item.name })}
      buildCreatePayload={(values) => ({ ...values, status: "ACTIVE" })}
      buildUpdatePayload={(values) => values}
      validate={async (values, _mode, editingId) =>
        (await service.existsByField("code", values.code, editingId)) ? `Mã "${values.code}" đã tồn tại` : null
      }
      columns={columns}
      renderForm={(form) => (
        <div className="grid grid-cols-2 gap-3">
          <TextFormField control={form.control} name="code" label="Mã" required />
          <TextFormField control={form.control} name="name" label="Tên" required />
        </div>
      )}
    />
  );
}
