"use client";

import { EntityListPage } from "@/components/master-data/EntityListPage";
import { DateFormField, SelectFormField, TextFormField } from "@/components/master-data/FormFields";
import { StatusBadge } from "@/components/master-data/StatusBadge";
import { DataTableColumnHeaderSort } from "@/components/ui/dataTable";
import { customerService, locationService, priceListService, productService } from "@/services/master-data";
import { findOverlappingPrices } from "@/services/pricing";
import { Customer, Location, Product } from "@/types/master-data";
import { TransportPrice } from "@/types/pricing";
import { useReferenceData } from "@/hooks/useReferenceData";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { z } from "zod";

const schema = z.object({
  customerId: z.string().min(1, "Vui lòng chọn khách hàng"),
  pickupLocationId: z.string().min(1, "Vui lòng chọn điểm nâng"),
  dropoffLocationId: z.string().min(1, "Vui lòng chọn điểm hạ"),
  productId: z.string().min(1, "Vui lòng chọn hàng hóa"),
  unit: z.string().optional(),
  salesPrice: z.number().min(0, "Đơn giá không được âm"),
  dropFee: z.number().min(0).optional(),
  vendorCost: z.number().min(0).optional(),
  driverTripSalary: z.number().min(0).optional(),
  ticketFee: z.number().min(0).optional(),
  otherFee: z.number().min(0).optional(),
  effectiveFrom: z.string().min(1, "Vui lòng chọn ngày hiệu lực từ"),
  effectiveTo: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const today = () => new Date().toISOString().slice(0, 10);

const defaultValues: FormValues = {
  customerId: "",
  pickupLocationId: "",
  dropoffLocationId: "",
  productId: "",
  unit: "",
  salesPrice: 0,
  dropFee: 0,
  vendorCost: 0,
  driverTripSalary: 0,
  ticketFee: 0,
  otherFee: 0,
  effectiveFrom: today(),
  effectiveTo: "",
  note: "",
};

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export default function PricingPage() {
  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const products = useReferenceData<Product>(() => productService.getAll(), "hàng hóa");

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "";
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "";

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const pickupOptions = locations
    .filter((l) => l.type === "PICKUP" || l.type === "BOTH")
    .map((l) => ({ value: l.id, label: l.name }));
  const dropoffOptions = locations
    .filter((l) => l.type === "DROPOFF" || l.type === "BOTH")
    .map((l) => ({ value: l.id, label: l.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));

  // Phải tính lại khi danh mục tham chiếu tải xong, nếu không các cột tên sẽ trắng.
  const columns = useMemo<ColumnDef<TransportPrice>[]>(
    () => [
    {
      id: "index",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="STT" />,
      cell: ({ row }) => <div>{row.index + 1}</div>,
    },
    {
      id: "customerId",
      accessorKey: "customerId",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Khách hàng" />,
      cell: ({ row }) => <div>{customerName(row.original.customerId)}</div>,
    },
    {
      id: "route",
      header: () => "Tuyến",
      cell: ({ row }) => (
        <div>
          {locationName(row.original.pickupLocationId)} → {locationName(row.original.dropoffLocationId)}
        </div>
      ),
    },
    {
      id: "productId",
      accessorKey: "productId",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Hàng hóa" />,
      cell: ({ row }) => <div>{productName(row.original.productId)}</div>,
    },
    {
      id: "salesPrice",
      accessorKey: "salesPrice",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Đơn giá" />,
      cell: ({ row }) => <div>{currencyFormatter.format(row.original.salesPrice ?? 0)}</div>,
    },
    {
      id: "effective",
      header: () => "Hiệu lực",
      cell: ({ row }) => (
        <div>
          {row.original.effectiveFrom} → {row.original.effectiveTo || "..."}
        </div>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeaderSort column={column} title="Trạng thái" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, locations, products]
  );

  return (
    <EntityListPage<TransportPrice, FormValues>
      resourceKey="price"
      entityLabel="Bảng giá vận chuyển"
      service={priceListService}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      dialogClassName="bg-white min-w-[720px] flex flex-col justify-between p-4"
      toFormValues={(item) => ({
        customerId: item.customerId,
        pickupLocationId: item.pickupLocationId,
        dropoffLocationId: item.dropoffLocationId,
        productId: item.productId,
        unit: item.unit ?? "",
        salesPrice: item.salesPrice ?? 0,
        dropFee: item.dropFee ?? 0,
        vendorCost: item.vendorCost ?? 0,
        driverTripSalary: item.driverTripSalary ?? 0,
        ticketFee: item.ticketFee ?? 0,
        otherFee: item.otherFee ?? 0,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo ?? "",
        note: item.note ?? "",
      })}
      buildCreatePayload={(v) => ({
        ...v,
        unit: v.unit ?? "",
        dropFee: v.dropFee ?? 0,
        vendorCost: v.vendorCost ?? 0,
        driverTripSalary: v.driverTripSalary ?? 0,
        ticketFee: v.ticketFee ?? 0,
        otherFee: v.otherFee ?? 0,
        note: v.note ?? "",
        // Chuỗi rỗng = không giới hạn ngày kết thúc (Firestore không nhận undefined).
        effectiveTo: v.effectiveTo ?? "",
        status: "ACTIVE",
      })}
      buildUpdatePayload={(v) => ({ ...v, note: v.note ?? "", effectiveTo: v.effectiveTo ?? "" })}
      validate={async (values, mode, editingId) => {
        if (values.effectiveTo && values.effectiveTo < values.effectiveFrom) {
          return "Ngày hết hiệu lực phải sau ngày bắt đầu hiệu lực";
        }
        const overlaps = await findOverlappingPrices({ ...values, excludeId: editingId });
        if (overlaps.length > 0) {
          return "Đã tồn tại bảng giá khác cho đúng tuyến/khách hàng/hàng hóa này trong khoảng thời gian trùng hiệu lực. Vui lòng điều chỉnh ngày hiệu lực hoặc ngừng hoạt động bảng giá cũ trước.";
        }
        return null;
      }}
      columns={columns}
      renderForm={(form) => (
        <div className="grid grid-cols-2 gap-3">
          <SelectFormField control={form.control} name="customerId" label="Khách hàng" options={customerOptions} placeholder="Chọn khách hàng" required />
          <SelectFormField control={form.control} name="productId" label="Hàng hóa" options={productOptions} placeholder="Chọn hàng hóa" required />
          <SelectFormField control={form.control} name="pickupLocationId" label="Điểm nâng" options={pickupOptions} placeholder="Chọn điểm nâng" required />
          <SelectFormField control={form.control} name="dropoffLocationId" label="Điểm hạ" options={dropoffOptions} placeholder="Chọn điểm hạ" required />
          <TextFormField control={form.control} name="unit" label="Đơn vị tính" />
          <TextFormField control={form.control} name="salesPrice" label="Đơn giá bán" type="number" required />
          <TextFormField control={form.control} name="dropFee" label="Giá hạ hàng" type="number" />
          <TextFormField control={form.control} name="vendorCost" label="Cước thuê (ĐV vận tải)" type="number" />
          <TextFormField control={form.control} name="driverTripSalary" label="Lương tài xế / chuyến" type="number" />
          <TextFormField control={form.control} name="ticketFee" label="Vé / phụ phí" type="number" />
          <TextFormField control={form.control} name="otherFee" label="Chi phí khác" type="number" />
          <DateFormField control={form.control} name="effectiveFrom" label="Hiệu lực từ ngày" clearable={false} required />
          <DateFormField control={form.control} name="effectiveTo" label="Hiệu lực đến ngày (để trống = không giới hạn)" />
        </div>
      )}
    />
  );
}
