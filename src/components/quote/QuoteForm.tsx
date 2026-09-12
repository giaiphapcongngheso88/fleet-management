"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { PrintHeader, PrintSignatureBlock } from "@/components/common/PrintHeader";
import { CurrencyFormField, DateFormField, SelectFormField, TextAreaFormField, TextFormField } from "@/components/master-data/FormFields";
import { QuoteStatusBadge } from "@/components/quote/QuoteStatusBadge";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import useLoading from "@/components/loading";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useReferenceData } from "@/hooks/useReferenceData";
import { customerService, locationService, productService } from "@/services/master-data";
import { findEffectivePrice } from "@/services/pricing";
import { computeQuoteTotals, generateQuoteNo, quoteService } from "@/services/quote";
import { Customer, Location, Product } from "@/types/master-data";
import { QUOTE_STATUS_LABEL, Quote, QuoteItem, QuoteStatus } from "@/types/quote";
import { getErrorMessage } from "@/utils/errorHandler";
import { setQuoteToTripPrefill } from "@/utils/quoteToTripHandoff";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths, format } from "date-fns";
import { ArrowRightLeft, Copy, Download, Plus, Printer, Trash2 } from "lucide-react";
import { exportQuoteToExcel } from "@/lib/excel/quoteExport";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);

const itemSchema = z.object({
  id: z.string(),
  pickupLocationId: z.string().min(1, "Chọn điểm nâng"),
  dropoffLocationId: z.string().min(1, "Chọn điểm hạ"),
  productId: z.string().min(1, "Chọn hàng hóa"),
  unit: z.string().optional(),
  quantity: z.number().positive("Số lượng phải > 0"),
  unitPrice: z.number().min(0, "Đơn giá không được âm"),
});

const schema = z
  .object({
    quoteDate: z.string().min(1, "Vui lòng chọn ngày báo giá"),
    customerId: z.string().min(1, "Vui lòng chọn khách hàng"),
    validFrom: z.string().min(1, "Vui lòng chọn ngày hiệu lực từ"),
    validTo: z.string().min(1, "Vui lòng chọn ngày hiệu lực đến"),
    items: z.array(itemSchema).min(1, "Báo giá phải có ít nhất 1 dòng"),
    status: z.enum(["DRAFT", "SENT", "APPROVED", "EXPIRED", "CANCELLED"]),
    note: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.status === "CANCELLED" && !values.note?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Vui lòng nhập lý do hủy báo giá" });
    }
  });

type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS = (Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((value) => ({
  value,
  label: QUOTE_STATUS_LABEL[value],
}));

const currencyFormatter = new Intl.NumberFormat("vi-VN");

const newItem = (): FormValues["items"][number] => ({
  id: uuidv4(),
  pickupLocationId: "",
  dropoffLocationId: "",
  productId: "",
  unit: "",
  quantity: 1,
  unitPrice: 0,
});

const defaultValues: FormValues = {
  quoteDate: today(),
  customerId: "",
  validFrom: today(),
  validTo: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
  items: [newItem()],
  status: "DRAFT",
  note: "",
};

function toFormValues(quote: Quote): FormValues {
  return {
    quoteDate: quote.quoteDate,
    customerId: quote.customerId,
    validFrom: quote.validFrom,
    validTo: quote.validTo,
    items: quote.items.map((item) => ({
      id: item.id,
      pickupLocationId: item.pickupLocationId,
      dropoffLocationId: item.dropoffLocationId,
      productId: item.productId,
      unit: item.unit ?? "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    status: quote.status,
    note: quote.note ?? "",
  };
}

export function QuoteForm({ quoteId }: { quoteId?: string }) {
  const mode: "create" | "edit" = quoteId ? "edit" : "create";
  const router = useRouter();
  const { showLoading, hideLoading } = useLoading();
  const { alert } = useFeedbackDialog();
  const { can } = usePermission();
  const { user } = useCurrentUser();
  const company = useCompanyInfo();

  const [loadedQuote, setLoadedQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(mode === "edit");

  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const products = useReferenceData<Product>(() => productService.getAll(), "hàng hóa");

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });
  const itemsArray = useFieldArray({ control: form.control, name: "items" });
  const watched = useWatch({ control: form.control });

  useEffect(() => {
    if (mode !== "edit" || !quoteId) return;
    let cancelled = false;
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    (async () => {
      try {
        const quote = await quoteService.getById(quoteId);
        if (cancelled) return;
        if (!quote) {
          await alert({ title: "Lỗi", content: "Không tìm thấy báo giá này" });
          router.push("/kinh-doanh/bao-gia");
          return;
        }
        setLoadedQuote(quote);
        form.reset(toFormValues(quote));
      } catch (err: unknown) {
        await alert({ title: "Lỗi", content: "Tải báo giá thất bại: " + getErrorMessage(err) });
      } finally {
        hideLoading(loadingId);
        if (!cancelled) setLoadingQuote(false);
      }
    })();
    return () => {
      cancelled = true;
      hideLoading(loadingId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, quoteId]);

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const pickupOptions = locations.filter((l) => l.type === "PICKUP" || l.type === "BOTH").map((l) => ({ value: l.id, label: l.name }));
  const dropoffOptions = locations.filter((l) => l.type === "DROPOFF" || l.type === "BOTH").map((l) => ({ value: l.id, label: l.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const customerName = (id: string) => {
    const c = customers.find((x) => x.id === id);
    return c ? `${c.code} - ${c.name}` : "";
  };
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "";

  const canOverridePricing = can("quote", "APPROVE");
  const isLocked =
    mode === "edit" &&
    (loadedQuote?.status === "APPROVED" || loadedQuote?.status === "CANCELLED" || loadedQuote?.status === "EXPIRED") &&
    !canOverridePricing;
  // Vào từ "Xem chi tiết" (role chỉ có VIEW, không có UPDATE) — khóa toàn bộ form.
  const viewOnly = mode === "edit" && !can("quote", "UPDATE");
  const readOnly = isLocked || viewOnly;

  const lookupPriceForItem = async (index: number) => {
    const values = form.getValues();
    const item = values.items[index];
    // Dòng chưa điền đủ tuyến/hàng hóa — người dùng còn đang điền dở, im lặng bỏ qua, không báo lỗi.
    if (!item.pickupLocationId || !item.dropoffLocationId || !item.productId) return;
    // Dòng đã đủ tuyến/hàng hóa nhưng còn thiếu Khách hàng/Ngày báo giá — báo rõ lý do, không im lặng
    // giữ nguyên đơn giá = 0 khiến người dùng tưởng bảng giá không hoạt động (đã tạo bảng giá đúng
    // nhưng không tự load được vì quên chọn Khách hàng hoặc Ngày báo giá).
    if (!values.customerId || !values.quoteDate) {
      await alert({ title: "Cảnh báo", content: "Vui lòng chọn Khách hàng và Ngày báo giá trước khi tra bảng giá." });
      return;
    }

    const result = await findEffectivePrice({
      customerId: values.customerId,
      pickupLocationId: item.pickupLocationId,
      dropoffLocationId: item.dropoffLocationId,
      productId: item.productId,
      date: values.quoteDate,
    });

    if (!result.price) {
      await alert({
        title: "Cảnh báo",
        content: "Chưa có bảng giá hiệu lực cho khách hàng/tuyến/hàng hóa/ngày này. Vui lòng nhập tay đơn giá nếu được phân quyền duyệt giá.",
      });
      return;
    }
    if (result.hasConflict) {
      await alert({ title: "Cảnh báo", content: "Có nhiều bảng giá cùng hiệu lực cho tuyến này. Hệ thống đã lấy bảng giá gần nhất." });
    }
    form.setValue(`items.${index}.unitPrice`, result.price.salesPrice ?? 0);
    if (result.price.unit) form.setValue(`items.${index}.unit`, result.price.unit);
  };

  /**
   * Đổi Khách hàng (field ở đầu form) phải tra lại giá cho MỌI dòng đã đủ tuyến/hàng hóa — nếu không,
   * dòng đã điền tuyến/hàng hóa trước khi chọn khách hàng (hoặc đổi khách hàng sau khi đã điền) sẽ
   * không bao giờ tự tra giá, im lặng giữ đơn giá = 0 mà không có gì báo cho người dùng biết vì sao.
   */
  const onCustomerChange = async () => {
    const values = form.getValues();
    for (let i = 0; i < values.items.length; i++) {
      const item = values.items[i];
      if (item.pickupLocationId && item.dropoffLocationId && item.productId) {
        await lookupPriceForItem(i);
      }
    }
  };

  const buildItemsPayload = (values: FormValues): QuoteItem[] =>
    values.items.map((item) => ({
      id: item.id,
      pickupLocationId: item.pickupLocationId,
      dropoffLocationId: item.dropoffLocationId,
      productId: item.productId,
      unit: item.unit || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: (item.quantity || 0) * (item.unitPrice || 0),
    }));

  const liveItems = (watched.items ?? []).map((item) => (item?.quantity || 0) * (item?.unitPrice || 0));
  const totals = computeQuoteTotals(liveItems.map((amount) => ({ amount }) as QuoteItem));

  const onSubmit = async (values: FormValues) => {
    if (isLocked) {
      await alert({ title: "Cảnh báo", content: "Báo giá đã duyệt/hủy/hết hạn — chỉ người có quyền duyệt giá mới được sửa." });
      return;
    }
    const items = buildItemsPayload(values);
    const computed = computeQuoteTotals(items);

    const payload = {
      quoteDate: values.quoteDate,
      customerId: values.customerId,
      validFrom: values.validFrom,
      validTo: values.validTo,
      items,
      status: values.status,
      note: values.note || undefined,
      ...computed,
    };

    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      if (mode === "create") {
        const quoteNo = await generateQuoteNo(values.quoteDate);
        await quoteService.create({ ...payload, quoteNo }, user?.id ?? "");
        await alert({ title: "Thành công", content: `Đã tạo báo giá ${quoteNo}` });
      } else if (quoteId) {
        await quoteService.update(quoteId, payload, user?.id ?? "");
        await alert({ title: "Thành công", content: "Cập nhật báo giá thành công" });
      }
      router.push("/kinh-doanh/bao-gia");
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lưu báo giá thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onDuplicate = async () => {
    if (!loadedQuote) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const quoteDate = today();
      const quoteNo = await generateQuoteNo(quoteDate);
      const newId = await quoteService.create(
        {
          quoteDate,
          customerId: loadedQuote.customerId,
          validFrom: quoteDate,
          validTo: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
          items: loadedQuote.items.map((item) => ({ ...item, id: uuidv4() })),
          status: "DRAFT",
          totalAmount: loadedQuote.totalAmount,
          quoteNo,
        },
        user?.id ?? ""
      );
      await alert({ title: "Thành công", content: `Đã nhân bản thành báo giá ${quoteNo}` });
      router.push(`/kinh-doanh/bao-gia/${newId}`);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Nhân bản báo giá thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onExportExcel = async () => {
    if (!loadedQuote) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const customer = customers.find((c) => c.id === loadedQuote.customerId);
      await exportQuoteToExcel(loadedQuote, customer, locationName, productName);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Xuất Excel thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onCreateTripFromItem = (index: number) => {
    const item = watched.items?.[index];
    if (!watched.customerId || !item?.pickupLocationId || !item?.dropoffLocationId || !item?.productId) {
      void alert({ title: "Cảnh báo", content: "Dòng báo giá chưa đủ thông tin khách hàng/tuyến/hàng hóa để tạo chuyến." });
      return;
    }
    setQuoteToTripPrefill({
      customerId: watched.customerId,
      pickupLocationId: item.pickupLocationId,
      dropoffLocationId: item.dropoffLocationId,
      productId: item.productId,
      quantity: item.quantity || 1,
      unit: item.unit || "",
      unitPrice: item.unitPrice || 0,
    });
    router.push("/van-tai/nhat-trinh/moi");
  };

  if (loadingQuote) return null;

  return (
    <>
      {loadedQuote && (
        <div className="hidden print:block">
          <PrintHeader title="Báo giá vận chuyển" company={company} />
          <div className="flex justify-between text-sm mb-3">
            <div>
              <p>
                <strong>Số báo giá:</strong> {loadedQuote.quoteNo}
              </p>
              <p>
                <strong>Khách hàng:</strong> {customerName(loadedQuote.customerId)}
              </p>
            </div>
            <div className="text-right">
              <p>
                <strong>Ngày báo giá:</strong> {loadedQuote.quoteDate}
              </p>
              <p>
                <strong>Hiệu lực:</strong> {loadedQuote.validFrom} → {loadedQuote.validTo}
              </p>
            </div>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-1 px-2">Tuyến</th>
                <th className="text-left py-1 px-2">Hàng hóa</th>
                <th className="text-left py-1 px-2">ĐVT</th>
                <th className="text-right py-1 px-2">SL</th>
                <th className="text-right py-1 px-2">Đơn giá</th>
                <th className="text-right py-1 px-2">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {loadedQuote.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-300">
                  <td className="py-1 px-2">
                    {locationName(item.pickupLocationId)} → {locationName(item.dropoffLocationId)}
                  </td>
                  <td className="py-1 px-2">{productName(item.productId)}</td>
                  <td className="py-1 px-2">{item.unit}</td>
                  <td className="text-right py-1 px-2">{item.quantity}</td>
                  <td className="text-right py-1 px-2">{currencyFormatter.format(item.unitPrice)}</td>
                  <td className="text-right py-1 px-2">{currencyFormatter.format(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-semibold">
                <td colSpan={5} className="text-right py-1 px-2">
                  Tổng tiền
                </td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(loadedQuote.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
          {loadedQuote.note && (
            <p className="text-sm mt-2">
              <strong>Ghi chú:</strong> {loadedQuote.note}
            </p>
          )}
          <PrintSignatureBlock partyLabel="Xác nhận của khách hàng" company={company} />
        </div>
      )}

      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="print:hidden flex flex-col gap-6 pb-8">
        {isLocked && (
          <div className="rounded-lg border border-warning-500 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:bg-warning-500/10">
            Báo giá này đã duyệt/hủy/hết hạn — bạn không có quyền duyệt giá nên không thể lưu thay đổi.
          </div>
        )}
        {viewOnly && !isLocked && (
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
            Bạn chỉ có quyền xem — không thể sửa báo giá này.
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Thông tin chung</h4>
            <div className="flex items-center gap-2">
              {loadedQuote && <QuoteStatusBadge status={loadedQuote.status} />}
              {mode === "edit" && (
                <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="flex items-center gap-1">
                  <Printer className="h-4 w-4" /> In báo giá
                </Button>
              )}
              {mode === "edit" && (
                <Button type="button" variant="outline" size="sm" onClick={() => void onExportExcel()} className="flex items-center gap-1">
                  <Download className="h-4 w-4" /> Xuất Excel
                </Button>
              )}
              {mode === "edit" && (
                <Button type="button" variant="outline" size="sm" onClick={onDuplicate} className="flex items-center gap-1">
                  <Copy className="h-4 w-4" /> Nhân bản
                </Button>
              )}
            </div>
          </div>
          <fieldset disabled={readOnly} className="contents">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <DateFormField control={form.control} name="quoteDate" label="Ngày báo giá" clearable={false} required />
            <SelectFormField
              control={form.control}
              name="customerId"
              label="Khách hàng"
              options={customerOptions}
              placeholder="Chọn khách hàng"
              required
              onValueChange={() => void onCustomerChange()}
            />
            <DateFormField control={form.control} name="validFrom" label="Hiệu lực từ" clearable={false} required />
            <DateFormField control={form.control} name="validTo" label="Hiệu lực đến" clearable={false} required />
            <SelectFormField control={form.control} name="status" label="Trạng thái" options={STATUS_OPTIONS} required />
          </div>
          </fieldset>
        </section>

        <fieldset disabled={readOnly} className="contents">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Chi tiết báo giá (mỗi dòng 1 tuyến)</h4>
            <Button type="button" variant="outline" size="sm" onClick={() => itemsArray.append(newItem())} className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> Thêm dòng
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {itemsArray.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end border-b pb-3 last:border-b-0">
                <SelectFormField
                  control={form.control}
                  name={`items.${index}.pickupLocationId`}
                  label="Điểm nâng"
                  options={pickupOptions}
                  placeholder="Chọn điểm nâng"
                  required
                  onValueChange={() => void lookupPriceForItem(index)}
                />
                <SelectFormField
                  control={form.control}
                  name={`items.${index}.dropoffLocationId`}
                  label="Điểm hạ"
                  options={dropoffOptions}
                  placeholder="Chọn điểm hạ"
                  required
                  onValueChange={() => void lookupPriceForItem(index)}
                />
                <SelectFormField
                  control={form.control}
                  name={`items.${index}.productId`}
                  label="Hàng hóa"
                  options={productOptions}
                  placeholder="Chọn hàng hóa"
                  required
                  onValueChange={() => void lookupPriceForItem(index)}
                />
                <TextFormField control={form.control} name={`items.${index}.quantity`} label="Số lượng" type="number" required />
                <TextFormField control={form.control} name={`items.${index}.unit`} label="ĐVT" />
                <CurrencyFormField
                  control={form.control}
                  name={`items.${index}.unitPrice`}
                  label="Đơn giá"
                  required
                  disabled={!canOverridePricing}
                />
                <div className="flex items-center justify-between sm:col-span-6 text-sm text-gray-500">
                  <span>
                    {locationName(watched.items?.[index]?.pickupLocationId ?? "")} → {locationName(watched.items?.[index]?.dropoffLocationId ?? "")}
                    {" — "}
                    Thành tiền: <strong>{currencyFormatter.format(liveItems[index] ?? 0)}</strong>
                  </span>
                  <div className="flex items-center gap-1">
                    {loadedQuote?.status === "APPROVED" && (
                      <Button type="button" variant="outline" size="sm" onClick={() => onCreateTripFromItem(index)} className="flex items-center gap-1">
                        <ArrowRightLeft className="h-4 w-4" /> Tạo chuyến
                      </Button>
                    )}
                    {itemsArray.fields.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => itemsArray.remove(index)}>
                        <Trash2 className="h-4 w-4 text-error-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs text-gray-400">Tổng tiền báo giá</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {currencyFormatter.format(totals.totalAmount)}
          </p>
        </section>

        <TextAreaFormField control={form.control} name="note" label="Ghi chú (bắt buộc khi hủy báo giá)" />
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/kinh-doanh/bao-gia")}>
            Hủy bỏ
          </Button>
          {!readOnly && (
            <Button type="submit" variant="default">
              Lưu báo giá
            </Button>
          )}
        </div>
      </form>
      </Form>
    </>
  );
}
