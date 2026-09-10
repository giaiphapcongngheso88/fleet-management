"use client";

import { EntityListPage } from "@/components/master-data/EntityListPage";
import { TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
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
