"use client";

import { EntityImportConfig, EntityListPage } from "@/components/master-data/EntityListPage";
import { SelectFormField, TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { ImportColumn } from "@/lib/excel/genericImport";
import { locationService } from "@/services/master-data";
import { LOCATION_TYPE_LABEL, Location, LocationType } from "@/types/master-data";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

const LOCATION_TYPE_OPTIONS = (Object.keys(LOCATION_TYPE_LABEL) as LocationType[]).map((value) => ({
  value,
  label: LOCATION_TYPE_LABEL[value],
}));

const schema = z.object({
  code: z.string().min(1, "Vui lòng nhập mã điểm"),
  name: z.string().min(1, "Vui lòng nhập tên điểm"),
  type: z.enum(["PICKUP", "DROPOFF", "BOTH"], { message: "Vui lòng chọn loại điểm" }),
  address: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = { code: "", name: "", type: "BOTH", address: "", note: "" };

const columns: ColumnDef<Location>[] = [
  {
    id: "index",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
    cell: ({ row }) => <div>{row.index + 1}</div>,
  },
  {
    id: "code",
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Mã điểm" />,
    cell: ({ row }) => <div>{row.original.code}</div>,
  },
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tên điểm" />,
    cell: ({ row }) => <div>{row.original.name}</div>,
  },
  {
    id: "type",
    accessorKey: "type",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Loại điểm" />,
    cell: ({ row }) => <div>{LOCATION_TYPE_LABEL[row.original.type]}</div>,
  },
  {
    id: "address",
    accessorKey: "address",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Địa chỉ" />,
    cell: ({ row }) => <div className="max-w-[300px] truncate">{row.original.address}</div>,
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

const LOCATION_TYPE_BY_ALIAS: Record<string, LocationType> = {
  pickup: "PICKUP",
  dropoff: "DROPOFF",
  both: "BOTH",
  "điểm nâng": "PICKUP",
  "điểm hạ": "DROPOFF",
  "nâng & hạ": "BOTH",
  "nâng và hạ": "BOTH",
  "nâng": "PICKUP",
  "hạ": "DROPOFF",
};

const IMPORT_COLUMNS: ImportColumn<Location>[] = [
  { key: "code", header: "Mã điểm", required: true, example: "DIEM001" },
  { key: "name", header: "Tên điểm", required: true, example: "Kho A, Quận 7" },
  { key: "type", header: "Loại điểm (*)", required: true, example: "Nâng & hạ" },
  { key: "address", header: "Địa chỉ" },
];

const importConfig: EntityImportConfig<Location> = {
  columns: IMPORT_COLUMNS,
  sheetName: "Điểm nâng-hạ",
  templateFileName: "mau-import-diem-nang-ha.xlsx",
  validateRow: async (raw, rowsSoFar, existingData) => {
    const code = String(raw.code ?? "").trim();
    const name = String(raw.name ?? "").trim();
    const typeRaw = String(raw.type ?? "")
      .trim()
      .toLowerCase();
    const type = LOCATION_TYPE_BY_ALIAS[typeRaw];
    const errors: string[] = [];
    if (typeRaw && !type) {
      errors.push(`Loại điểm "${raw.type}" không hợp lệ — chỉ nhận "Điểm nâng", "Điểm hạ" hoặc "Nâng & hạ"`);
    }
    if (code) {
      if (existingData.some((l) => l.code.toLowerCase() === code.toLowerCase())) errors.push(`Mã "${code}" đã tồn tại trong hệ thống`);
      else if (rowsSoFar.some((l) => l.code.toLowerCase() === code.toLowerCase())) errors.push(`Mã "${code}" bị trùng trong file`);
    }
    if (errors.length > 0) return { errors };
    return {
      payload: {
        code,
        name,
        type: type ?? "BOTH",
        address: String(raw.address ?? "") || undefined,
        status: "ACTIVE",
      },
      errors: [],
    };
  },
};

export default function LocationPage() {
  return (
    <EntityListPage<Location, FormValues>
      resourceKey="location"
      entityLabel="Điểm nâng/hạ"
      service={locationService}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      toFormValues={(item) => ({
        code: item.code,
        name: item.name,
        type: item.type,
        address: item.address ?? "",
        note: item.note ?? "",
      })}
      buildCreatePayload={(v) => ({ ...v, status: "ACTIVE" })}
      buildUpdatePayload={(v) => ({ ...v })}
      validate={async (values, mode, editingId) => {
        const dup = await locationService.existsByField("code", values.code, editingId);
        return dup ? "Mã điểm nâng/hạ đã tồn tại" : null;
      }}
      importConfig={importConfig}
      columns={columns}
      renderForm={(form) => (
        <div className="grid grid-cols-2 gap-3">
          <TextFormField control={form.control} name="code" label="Mã điểm" required />
          <TextFormField control={form.control} name="name" label="Tên điểm" required />
          <SelectFormField control={form.control} name="type" label="Loại điểm" options={LOCATION_TYPE_OPTIONS} required />
          <TextAreaFormField control={form.control} name="address" label="Địa chỉ" className="col-span-2" />
          <TextAreaFormField control={form.control} name="note" label="Ghi chú" className="col-span-2" />
        </div>
      )}
    />
  );
}
