"use client";

import { EntityImportConfig, EntityListPage } from "@/components/master-data/EntityListPage";
import { SelectFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { ImportColumn } from "@/lib/excel/genericImport";
import { driverService, vehicleService, vendorService } from "@/services/master-data";
import { Driver, Vehicle, Vendor } from "@/types/master-data";
import { useReferenceData } from "@/hooks/useReferenceData";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { z } from "zod";

const IMPORT_COLUMNS: ImportColumn<Vehicle>[] = [
  { key: "licensePlate", header: "Biển số xe", required: true, example: "51C-12345" },
  { key: "trailerNumber", header: "Số mooc" },
  { key: "driverId", header: "Tên tài xế", example: "Nguyễn Văn A" },
  { key: "vendorId", header: "Tên đơn vị vận tải", example: "Công ty vận tải XYZ" },
  { key: "phone", header: "Điện thoại", example: "0901234567" },
];

const schema = z.object({
  licensePlate: z.string().min(1, "Vui lòng nhập biển số xe"),
  trailerNumber: z.string().optional(),
  driverId: z.string().optional(),
  vendorId: z.string().optional(),
  phone: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  licensePlate: "",
  trailerNumber: "",
  driverId: "",
  vendorId: "",
  phone: "",
  note: "",
};

export default function VehiclePage() {
  const drivers = useReferenceData<Driver>(() => driverService.getAll(), "tài xế");
  const vendors = useReferenceData<Vendor>(() => vendorService.getAll(), "đơn vị vận tải");

  const driverName = (id?: string) => drivers.find((d) => d.id === id)?.name ?? "";
  const vendorName = (id?: string) => vendors.find((v) => v.id === id)?.name ?? "";
  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.name }));
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

  const importConfig: EntityImportConfig<Vehicle> = {
    columns: IMPORT_COLUMNS,
    sheetName: "Xe",
    templateFileName: "mau-import-xe.xlsx",
    validateRow: async (raw, rowsSoFar, existingData) => {
      const licensePlate = String(raw.licensePlate ?? "").trim();
      const driverNameRaw = String(raw.driverId ?? "").trim();
      const vendorNameRaw = String(raw.vendorId ?? "").trim();
      const errors: string[] = [];

      if (licensePlate) {
        if (existingData.some((v) => v.licensePlate.toLowerCase() === licensePlate.toLowerCase()))
          errors.push(`Biển số "${licensePlate}" đã tồn tại trong hệ thống`);
        else if (rowsSoFar.some((v) => v.licensePlate.toLowerCase() === licensePlate.toLowerCase()))
          errors.push(`Biển số "${licensePlate}" bị trùng trong file`);
      }

      const matchedDriver = driverNameRaw ? drivers.find((d) => d.name.toLowerCase() === driverNameRaw.toLowerCase()) : undefined;
      if (driverNameRaw && !matchedDriver) errors.push(`Không tìm thấy tài xế tên "${driverNameRaw}" — vui lòng tạo tài xế trước`);

      const matchedVendor = vendorNameRaw ? vendors.find((v) => v.name.toLowerCase() === vendorNameRaw.toLowerCase()) : undefined;
      if (vendorNameRaw && !matchedVendor) errors.push(`Không tìm thấy đơn vị vận tải tên "${vendorNameRaw}" — vui lòng tạo trước`);

      if (errors.length > 0) return { errors };
      return {
        payload: {
          licensePlate,
          trailerNumber: String(raw.trailerNumber ?? "") || undefined,
          driverId: matchedDriver?.id,
          vendorId: matchedVendor?.id,
          phone: String(raw.phone ?? "") || undefined,
          status: "ACTIVE",
        },
        errors: [],
      };
    },
  };

  // Phải tính lại khi danh mục tài xế / ĐV vận tải tải xong, nếu không các cột tên sẽ trắng.
  const columns = useMemo<ColumnDef<Vehicle>[]>(
    () => [
    {
      id: "index",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
      cell: ({ row }) => <div>{row.index + 1}</div>,
    },
    {
      id: "licensePlate",
      accessorKey: "licensePlate",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Biển số xe" />,
      cell: ({ row }) => <div>{row.original.licensePlate}</div>,
    },
    {
      id: "trailerNumber",
      accessorKey: "trailerNumber",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Số mooc" />,
      cell: ({ row }) => <div>{row.original.trailerNumber}</div>,
    },
    {
      id: "driverId",
      accessorKey: "driverId",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Tài xế" />,
      cell: ({ row }) => <div>{driverName(row.original.driverId)}</div>,
      meta: { exportValue: (row) => driverName(row.driverId) },
    },
    {
      id: "vendorId",
      accessorKey: "vendorId",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="ĐV vận tải" />,
      cell: ({ row }) => <div>{vendorName(row.original.vendorId)}</div>,
      meta: { exportValue: (row) => vendorName(row.vendorId) },
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Điện thoại" />,
      cell: ({ row }) => <div>{row.original.phone}</div>,
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drivers, vendors]
  );

  return (
    <EntityListPage<Vehicle, FormValues>
      resourceKey="vehicle"
      entityLabel="Xe"
      service={vehicleService}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      toFormValues={(item) => ({
        licensePlate: item.licensePlate,
        trailerNumber: item.trailerNumber ?? "",
        driverId: item.driverId ?? "",
        vendorId: item.vendorId ?? "",
        phone: item.phone ?? "",
        note: item.note ?? "",
      })}
      buildCreatePayload={(v) => ({ ...v, status: "ACTIVE" })}
      buildUpdatePayload={(v) => ({ ...v })}
      validate={async (values, mode, editingId) => {
        const dup = await vehicleService.existsByField("licensePlate", values.licensePlate, editingId);
        return dup ? "Biển số xe đã tồn tại" : null;
      }}
      importConfig={importConfig}
      columns={columns}
      renderForm={(form) => (
        <div className="grid grid-cols-2 gap-3">
          <TextFormField control={form.control} name="licensePlate" label="Biển số xe" required />
          <TextFormField control={form.control} name="trailerNumber" label="Số mooc" />
          <SelectFormField
            control={form.control}
            name="driverId"
            label="Tài xế"
            options={driverOptions}
            placeholder="Chọn tài xế"
          />
          <SelectFormField
            control={form.control}
            name="vendorId"
            label="Đơn vị vận tải"
            options={vendorOptions}
            placeholder="Chọn đơn vị vận tải"
          />
          <TextFormField control={form.control} name="phone" label="Điện thoại" />
        </div>
      )}
    />
  );
}
