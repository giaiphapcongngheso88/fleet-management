"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { CurrencyFormField, DateFormField, SelectFormField, TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import { TripStatusBadge } from "@/components/trip/TripStatusBadge";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import useLoading from "@/components/loading";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { useReferenceData } from "@/hooks/useReferenceData";
import { costTypeService, customerService, driverService, locationService, productService, vehicleService } from "@/services/master-data";
import { findEffectivePrice } from "@/services/pricing";
import { computeTripTotals, generateTripCode, tripService } from "@/services/trip";
import { CostType } from "@/types/cost-type";
import { Customer, Driver, Location, Product, Vehicle } from "@/types/master-data";
import { TRIP_STATUS_LABEL, Trip, TripCost, TripItem, TripStatus } from "@/types/trip";
import { getErrorMessage } from "@/utils/errorHandler";
import { consumeQuoteToTripPrefill } from "@/utils/quoteToTripHandoff";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);

const itemSchema = z.object({
  id: z.string(),
  productId: z.string().min(1, "Chọn hàng hóa"),
  quantity: z.number().positive("Số lượng phải > 0"),
  unit: z.string().optional(),
  unitPrice: z.number().min(0, "Đơn giá không được âm"),
  dropFee: z.number().min(0).optional(),
});

const costSchema = z.object({
  id: z.string(),
  costTypeId: z.string().min(1, "Chọn loại chi phí"),
  amount: z.number().min(0, "Số tiền không được âm"),
  description: z.string().optional(),
  transactionDate: z.string().min(1, "Chọn ngày"),
});

const schema = z
  .object({
    tripDate: z.string().min(1, "Vui lòng chọn ngày"),
    customerId: z.string().min(1, "Vui lòng chọn khách hàng"),
    vehicleId: z.string().min(1, "Vui lòng chọn xe"),
    driverId: z.string().min(1, "Vui lòng chọn tài xế"),
    vendorId: z.string().optional(),
    lot: z.string().optional(),
    pickupLocationId: z.string().min(1, "Vui lòng chọn điểm nâng"),
    dropoffLocationId: z.string().min(1, "Vui lòng chọn điểm hạ"),
    priceListId: z.string().optional(),
    driverTripSalary: z.number().min(0).optional(),
    vendorCost: z.number().min(0).optional(),
    fuelNormAmount: z.number().min(0).optional(),
    items: z.array(itemSchema).min(1, "Chuyến phải có ít nhất 1 dòng hàng hóa"),
    costs: z.array(costSchema),
    status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "RECONCILED", "CANCELLED"]),
    note: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.status === "CANCELLED" && !values.note?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Vui lòng nhập lý do hủy chuyến" });
    }
  });

type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS = (Object.keys(TRIP_STATUS_LABEL) as TripStatus[]).map((value) => ({
  value,
  label: TRIP_STATUS_LABEL[value],
}));

const currencyFormatter = new Intl.NumberFormat("vi-VN");

const newItem = (): FormValues["items"][number] => ({
  id: uuidv4(),
  productId: "",
  quantity: 1,
  unit: "",
  unitPrice: 0,
  dropFee: 0,
});

const newCost = (defaultDate: string): FormValues["costs"][number] => ({
  id: uuidv4(),
  costTypeId: "",
  amount: 0,
  description: "",
  transactionDate: defaultDate,
});

const defaultValues: FormValues = {
  tripDate: today(),
  customerId: "",
  vehicleId: "",
  driverId: "",
  vendorId: "",
  lot: "",
  pickupLocationId: "",
  dropoffLocationId: "",
  priceListId: "",
  driverTripSalary: 0,
  vendorCost: 0,
  fuelNormAmount: 0,
  items: [newItem()],
  costs: [],
  status: "DRAFT",
  note: "",
};

function toFormValues(trip: Trip): FormValues {
  return {
    tripDate: trip.tripDate,
    customerId: trip.customerId,
    vehicleId: trip.vehicleId,
    driverId: trip.driverId,
    vendorId: trip.vendorId ?? "",
    lot: trip.lot ?? "",
    pickupLocationId: trip.pickupLocationId,
    dropoffLocationId: trip.dropoffLocationId,
    priceListId: trip.priceListId ?? "",
    driverTripSalary: trip.driverTripSalary ?? 0,
    vendorCost: trip.vendorCost ?? 0,
    fuelNormAmount: trip.fuelNormAmount ?? 0,
    items:
      trip.items.length > 0
        ? trip.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit ?? "",
            unitPrice: item.unitPrice,
            dropFee: item.dropFee ?? 0,
          }))
        : [newItem()],
    costs: trip.costs.map((c) => ({
      id: c.id,
      costTypeId: c.costTypeId,
      amount: c.amount,
      description: c.description ?? "",
      transactionDate: c.transactionDate,
    })),
    status: trip.status,
    note: trip.note ?? "",
  };
}

export function TripForm({ tripId }: { tripId?: string }) {
  const mode: "create" | "edit" = tripId ? "edit" : "create";
  const router = useRouter();
  const { showLoading, hideLoading } = useLoading();
  const { alert } = useFeedbackDialog();
  const { can } = usePermission();
  const { user } = useCurrentUser();

  const [loadedTrip, setLoadedTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(mode === "edit");

  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const vehicles = useReferenceData<Vehicle>(() => vehicleService.getAll(), "xe");
  const drivers = useReferenceData<Driver>(() => driverService.getAll(), "tài xế");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const products = useReferenceData<Product>(() => productService.getAll(), "hàng hóa");
  const costTypes = useReferenceData<CostType>(() => costTypeService.getAll(), "loại chi phí");

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });
  const itemsArray = useFieldArray({ control: form.control, name: "items" });
  const costsArray = useFieldArray({ control: form.control, name: "costs" });
  const watched = useWatch({ control: form.control });

  useEffect(() => {
    if (mode !== "edit" || !tripId) return;
    let cancelled = false;
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    (async () => {
      try {
        const trip = await tripService.getById(tripId);
        if (cancelled) return;
        if (!trip) {
          await alert({ title: "Lỗi", content: "Không tìm thấy chuyến này" });
          router.push("/van-tai/nhat-trinh");
          return;
        }
        setLoadedTrip(trip);
        form.reset(toFormValues(trip));
      } catch (err: unknown) {
        await alert({ title: "Lỗi", content: "Tải chuyến thất bại: " + getErrorMessage(err) });
      } finally {
        hideLoading(loadingId);
        if (!cancelled) setLoadingTrip(false);
      }
    })();
    return () => {
      cancelled = true;
      hideLoading(loadingId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tripId]);

  // Điền sẵn từ 1 dòng báo giá đã duyệt khi bấm "Tạo chuyến" ở trang Báo giá (mục 28.5 mở rộng).
  // Chỉ áp dụng đúng 1 lần lúc mới vào trang tạo chuyến, không áp dụng ở chế độ sửa.
  useEffect(() => {
    if (mode !== "create") return;
    const prefill = consumeQuoteToTripPrefill();
    if (!prefill) return;
    form.setValue("customerId", prefill.customerId);
    form.setValue("pickupLocationId", prefill.pickupLocationId);
    form.setValue("dropoffLocationId", prefill.dropoffLocationId);
    form.setValue("items.0.productId", prefill.productId);
    form.setValue("items.0.quantity", prefill.quantity);
    form.setValue("items.0.unit", prefill.unit);
    form.setValue("items.0.unitPrice", prefill.unitPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const vehicleOptions = vehicles.map((v) => ({ value: v.id, label: v.licensePlate }));
  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.name }));
  const pickupOptions = locations
    .filter((l) => l.type === "PICKUP" || l.type === "BOTH")
    .map((l) => ({ value: l.id, label: l.name }));
  const dropoffOptions = locations
    .filter((l) => l.type === "DROPOFF" || l.type === "BOTH")
    .map((l) => ({ value: l.id, label: l.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));
  const costTypeOptions = costTypes
    .filter((c) => c.isTripCost ?? true)
    .map((c) => ({ value: c.id, label: c.name }));

  const canOverridePricing = can("trip", "APPROVE");
  const isLocked = mode === "edit" && loadedTrip?.status === "RECONCILED" && !can("trip", "UNLOCK");
  // Vào từ "Xem chi tiết" (role chỉ có VIEW, không có UPDATE) — khóa toàn bộ form, không phải chỉ
  // khóa khi chuyến đã đối soát như isLocked ở trên.
  const viewOnly = mode === "edit" && !can("trip", "UPDATE");
  const readOnly = isLocked || viewOnly;

  const onVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;
    form.setValue("driverId", vehicle.driverId ?? "");
    form.setValue("vendorId", vehicle.vendorId ?? "");
  };

  const lookupPriceForItem = async (index: number, productId: string) => {
    const values = form.getValues();
    const product = products.find((p) => p.id === productId);
    if (product) form.setValue(`items.${index}.unit`, product.unit);

    if (!values.customerId || !values.pickupLocationId || !values.dropoffLocationId || !values.tripDate) {
      await alert({
        title: "Cảnh báo",
        content: "Vui lòng chọn khách hàng, điểm nâng, điểm hạ và ngày chuyến trước khi tra bảng giá.",
      });
      return;
    }

    const result = await findEffectivePrice({
      customerId: values.customerId,
      pickupLocationId: values.pickupLocationId,
      dropoffLocationId: values.dropoffLocationId,
      productId,
      date: values.tripDate,
    });

    if (!result.price) {
      await alert({
        title: "Cảnh báo",
        content:
          "Chưa có bảng giá hiệu lực cho khách hàng/tuyến/hàng hóa/ngày này. Vui lòng thiết lập bảng giá trước, hoặc nhập tay đơn giá nếu được phân quyền duyệt giá.",
      });
      return;
    }
    if (result.hasConflict) {
      await alert({
        title: "Cảnh báo",
        content: "Có nhiều bảng giá cùng hiệu lực cho tuyến này. Hệ thống đã lấy bảng giá thiết lập gần nhất — vui lòng kiểm tra lại.",
      });
    }

    const price = result.price;
    form.setValue(`items.${index}.unitPrice`, price.salesPrice ?? 0);
    if (price.unit) form.setValue(`items.${index}.unit`, price.unit);

    if (index === 0) {
      form.setValue(`items.${index}.dropFee`, price.dropFee ?? 0);
      form.setValue("priceListId", price.id);
      form.setValue("driverTripSalary", price.driverTripSalary ?? 0);
      form.setValue("vendorCost", price.vendorCost ?? 0);
      form.setValue("fuelNormAmount", price.fuelNormAmount ?? 0);
    }
  };

  /**
   * Đổi Khách hàng/Điểm nâng/Điểm hạ (field ở đầu form) phải tra lại giá cho MỌI dòng hàng hóa đã
   * chọn — nếu không, dòng đã chọn hàng hóa trước khi điền đủ khách hàng/tuyến (hoặc sửa lại tuyến
   * sau khi đã chọn hàng hóa) sẽ không bao giờ tự tra lại giá, giữ nguyên đơn giá cũ/0 một cách im
   * lặng dù bảng giá cho tổ hợp mới đã tồn tại.
   */
  const lookupPriceForAllItems = async () => {
    const values = form.getValues();
    for (let i = 0; i < values.items.length; i++) {
      const productId = values.items[i].productId;
      if (productId) await lookupPriceForItem(i, productId);
    }
  };

  const buildItemsPayload = (values: FormValues): TripItem[] =>
    values.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unit: item.unit || "",
      unitPrice: item.unitPrice,
      amount: (item.quantity || 0) * (item.unitPrice || 0),
      dropFee: item.dropFee || 0,
    }));

  const buildCostsPayload = (values: FormValues): TripCost[] =>
    values.costs.map((c) => {
      const costType = costTypes.find((ct) => ct.id === c.costTypeId);
      return {
        id: c.id,
        costTypeId: c.costTypeId,
        amount: c.amount,
        description: c.description || "",
        transactionDate: c.transactionDate,
        isFuel: costType?.isFuel ?? false,
      };
    });

  const liveItems = (watched.items ?? []).map((item) => ({
    amount: (item?.quantity || 0) * (item?.unitPrice || 0),
    dropFee: item?.dropFee || 0,
  }));
  const liveCosts = (watched.costs ?? []).map((c) => ({
    amount: c?.amount || 0,
    isFuel: costTypes.find((ct) => ct.id === c?.costTypeId)?.isFuel ?? false,
  }));
  const totals = computeTripTotals(liveItems as TripItem[], liveCosts as TripCost[], {
    vendorCost: watched.vendorCost || 0,
    driverTripSalary: watched.driverTripSalary || 0,
    fuelNormAmount: watched.fuelNormAmount || 0,
  });

  const onSubmit = async (values: FormValues) => {
    if (isLocked) {
      await alert({ title: "Cảnh báo", content: "Chuyến đã đối soát — chỉ người có quyền mở khóa mới được sửa." });
      return;
    }
    const items = buildItemsPayload(values);
    const costs = buildCostsPayload(values);
    const computed = computeTripTotals(items, costs, {
      vendorCost: values.vendorCost || 0,
      driverTripSalary: values.driverTripSalary || 0,
      fuelNormAmount: values.fuelNormAmount || 0,
    });

    const payload = {
      tripDate: values.tripDate,
      customerId: values.customerId,
      vendorId: values.vendorId || undefined,
      vehicleId: values.vehicleId,
      driverId: values.driverId,
      lot: values.lot || undefined,
      pickupLocationId: values.pickupLocationId,
      dropoffLocationId: values.dropoffLocationId,
      priceListId: values.priceListId || undefined,
      driverTripSalary: values.driverTripSalary || 0,
      vendorCost: values.vendorCost || 0,
      fuelNormAmount: values.fuelNormAmount || 0,
      items,
      costs,
      status: values.status,
      note: values.note || undefined,
      ...computed,
    };

    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      if (mode === "create") {
        const tripCode = await generateTripCode(values.tripDate);
        await tripService.create({ ...payload, tripCode }, user?.id ?? "");
        await alert({ title: "Thành công", content: `Đã tạo chuyến ${tripCode}` });
      } else if (tripId) {
        await tripService.update(tripId, payload, user?.id ?? "");
        await alert({ title: "Thành công", content: "Cập nhật chuyến thành công" });
      }
      router.push("/van-tai/nhat-trinh");
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lưu chuyến thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  if (loadingTrip) return null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 pb-8">
        {isLocked && (
          <div className="rounded-lg border border-warning-500 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:bg-warning-500/10">
            Chuyến này đã ở trạng thái <strong>Đã đối soát</strong> — bạn không có quyền mở khóa nên không thể lưu thay
            đổi.
          </div>
        )}
        {viewOnly && !isLocked && (
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
            Bạn chỉ có quyền xem — không thể sửa chuyến này.
          </div>
        )}

        <fieldset disabled={readOnly} className="contents">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Thông tin chung</h4>
            {loadedTrip && <TripStatusBadge status={loadedTrip.status} />}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <DateFormField control={form.control} name="tripDate" label="Ngày chuyến" clearable={false} required />
            <SelectFormField
              control={form.control}
              name="customerId"
              label="Khách hàng"
              options={customerOptions}
              placeholder="Chọn khách hàng"
              required
              onValueChange={() => void lookupPriceForAllItems()}
            />
            <SelectFormField
              control={form.control}
              name="vehicleId"
              label="Xe"
              options={vehicleOptions}
              placeholder="Chọn xe"
              required
              onValueChange={onVehicleChange}
            />
            <SelectFormField control={form.control} name="driverId" label="Tài xế" options={driverOptions} placeholder="Chọn tài xế" required />
            <SelectFormField
              control={form.control}
              name="pickupLocationId"
              label="Điểm nâng"
              options={pickupOptions}
              placeholder="Chọn điểm nâng"
              required
              onValueChange={() => void lookupPriceForAllItems()}
            />
            <SelectFormField
              control={form.control}
              name="dropoffLocationId"
              label="Điểm hạ"
              options={dropoffOptions}
              placeholder="Chọn điểm hạ"
              required
              onValueChange={() => void lookupPriceForAllItems()}
            />
            <TextFormField control={form.control} name="lot" label="Lot" />
            <SelectFormField control={form.control} name="status" label="Trạng thái" options={STATUS_OPTIONS} required />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Hàng hóa (đơn giá theo chuyến)</h4>
            <Button type="button" variant="outline" size="sm" onClick={() => itemsArray.append(newItem())} className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> Thêm dòng
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {itemsArray.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end border-b pb-3 last:border-b-0">
                <SelectFormField
                  control={form.control}
                  name={`items.${index}.productId`}
                  label="Hàng hóa"
                  options={productOptions}
                  placeholder="Chọn hàng hóa"
                  required
                  className="sm:col-span-2"
                  onValueChange={(value) => void lookupPriceForItem(index, value)}
                />
                <TextFormField control={form.control} name={`items.${index}.quantity`} label="Số lượng" type="number" required />
                <TextFormField control={form.control} name={`items.${index}.unit`} label="ĐVT" />
                <CurrencyFormField control={form.control} name={`items.${index}.unitPrice`} label="Đơn giá" required />
                <CurrencyFormField control={form.control} name={`items.${index}.dropFee`} label="Hạ hàng" />
                <div className="flex items-center justify-between sm:col-span-6 text-sm text-gray-500">
                  <span>
                    Thành tiền: <strong>{currencyFormatter.format(liveItems[index]?.amount ?? 0)}</strong>
                  </span>
                  {itemsArray.fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => itemsArray.remove(index)}>
                      <Trash2 className="h-4 w-4 text-error-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-3">
            Giá trị chốt theo bảng giá (lương tài xế / cước thuê / định mức dầu)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CurrencyFormField
              control={form.control}
              name="driverTripSalary"
              label="Lương tài xế / chuyến"
              disabled={!canOverridePricing}
            />
            <CurrencyFormField control={form.control} name="vendorCost" label="Cước thuê (ĐV vận tải)" disabled={!canOverridePricing} />
            <CurrencyFormField control={form.control} name="fuelNormAmount" label="Định mức tiền dầu tham chiếu" disabled={!canOverridePricing} />
          </div>
          {!canOverridePricing && (
            <p className="text-xs text-gray-400 mt-2">
              Các giá trị này được tự động chốt theo bảng giá khi chọn hàng hóa đầu tiên. Cần quyền duyệt giá để sửa tay.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Chi phí phát sinh trong chuyến</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => costsArray.append(newCost(form.getValues("tripDate") || today()))}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Thêm dòng
            </Button>
          </div>
          {costsArray.fields.length === 0 && <p className="text-sm text-gray-400">Chưa có chi phí phát sinh nào.</p>}
          <div className="flex flex-col gap-3">
            {costsArray.fields.map((field, index) => {
              const selectedCostType = costTypes.find((ct) => ct.id === watched.costs?.[index]?.costTypeId);
              return (
                <div key={field.id} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end border-b pb-3 last:border-b-0">
                  <SelectFormField
                    control={form.control}
                    name={`costs.${index}.costTypeId`}
                    label={`Loại chi phí${selectedCostType?.isFuel ? " (nhiên liệu)" : ""}`}
                    options={costTypeOptions}
                    placeholder="Chọn loại chi phí"
                    required
                  />
                  <DateFormField control={form.control} name={`costs.${index}.transactionDate`} label="Ngày" clearable={false} required />
                  <CurrencyFormField control={form.control} name={`costs.${index}.amount`} label="Số tiền" required />
                  <TextFormField control={form.control} name={`costs.${index}.description`} label="Mô tả" className="sm:col-span-2" />
                  <div className="flex justify-end sm:col-span-5">
                    <Button type="button" variant="ghost" size="sm" onClick={() => costsArray.remove(index)}>
                      <Trash2 className="h-4 w-4 text-error-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Doanh thu</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{currencyFormatter.format(totals.revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Chi phí</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{currencyFormatter.format(totals.cost)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Lợi nhuận</p>
            <p className={`text-lg font-semibold ${totals.profit < 0 ? "text-error-500" : "text-success-600"}`}>
              {currencyFormatter.format(totals.profit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Chênh lệch dầu (thực tế - định mức)</p>
            <p className={`text-lg font-semibold ${totals.fuelVarianceAmount > 0 ? "text-error-500" : "text-success-600"}`}>
              {currencyFormatter.format(totals.fuelVarianceAmount)}
            </p>
            <p className="text-xs text-gray-400">
              Thực tế {currencyFormatter.format(totals.fuelActualAmount)} / Định mức {currencyFormatter.format(watched.fuelNormAmount || 0)}
            </p>
          </div>
        </section>

        <TextAreaFormField control={form.control} name="note" label="Ghi chú (bắt buộc khi hủy chuyến)" />
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/van-tai/nhat-trinh")}>
            Hủy bỏ
          </Button>
          {!readOnly && (
            <Button type="submit" variant="default">
              Lưu chuyến
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
