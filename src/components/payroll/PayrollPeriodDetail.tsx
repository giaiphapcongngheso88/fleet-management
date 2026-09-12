"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { PrintHeader, PrintSignatureBlock } from "@/components/common/PrintHeader";
import useLoading from "@/components/loading";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/select/multi-select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useReferenceData } from "@/hooks/useReferenceData";
import { driverService, locationService } from "@/services/master-data";
import { financeTransactionService, generateTransactionNo } from "@/services/finance";
import {
  calculatePayrollPeriodItems,
  computePayrollItemNet,
  computePayrollPeriodTotals,
  payrollPeriodService,
} from "@/services/payroll";
import { tripService } from "@/services/trip";
import { exportPayrollPeriodToExcel } from "@/lib/excel/payrollExport";
import { Driver, Location } from "@/types/master-data";
import { PayrollItem, PayrollPeriod } from "@/types/payroll";
import { Trip } from "@/types/trip";
import { getErrorMessage } from "@/utils/errorHandler";
import { Download, Printer, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export function PayrollPeriodDetail({ periodId }: { periodId: string }) {
  const router = useRouter();
  const { alert, confirm } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { can } = usePermission();
  const { user } = useCurrentUser();
  const company = useCompanyInfo();

  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [showUnlockBox, setShowUnlockBox] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [tripsById, setTripsById] = useState<Record<string, Trip>>({});
  const [printingDriverId, setPrintingDriverId] = useState<string | null>(null);
  // Bỏ tick 1 tài xế = loại tài xế đó khỏi "In bảng lương"/"Xuất Excel" cả kỳ (không tính vào tổng
  // tiền in/xuất) — mặc định tick hết (Set rỗng = không loại ai), không ảnh hưởng khi in riêng 1
  // phiếu ("In phiếu" từng dòng vẫn luôn in đúng tài xế đó bất kể tick/bỏ tick ở đây).
  const [excludedFromPrint, setExcludedFromPrint] = useState<Set<string>>(new Set());
  const [expandedDriverIds, setExpandedDriverIds] = useState<Set<string>>(new Set());
  const [advanceDriverId, setAdvanceDriverId] = useState<string | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0, 10));

  const toggleExcludedFromPrint = (driverId: string, checked: boolean) => {
    setExcludedFromPrint((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  const toggleExpanded = (driverId: string) => {
    setExpandedDriverIds((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  const drivers = useReferenceData<Driver>(() => driverService.getAll(), "tài xế");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const routeName = (trip: Trip) => `${locationName(trip.pickupLocationId)} → ${locationName(trip.dropoffLocationId)}`;

  // In riêng phiếu lương 1 tài xế — đợi 1 khung hình để bản in ẩn kịp lọc đúng tài xế rồi mới in,
  // tự bỏ chọn sau khi hộp thoại in đóng (in xong hay hủy) để lần "In bảng lương" (cả kỳ) sau đó không
  // bị dính nhầm chỉ còn 1 tài xế.
  useEffect(() => {
    if (!printingDriverId) return;
    const raf = requestAnimationFrame(() => window.print());
    const onAfterPrint = () => setPrintingDriverId(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printingDriverId]);

  // Tải chi tiết từng chuyến đã tính vào lương (mã chuyến, ngày, lương chuyến) để in kèm cách tính,
  // không chỉ hiện tổng "Lương chuyến" 1 dòng — chỉ tải các chuyến chưa có sẵn, tránh gọi lại thừa.
  useEffect(() => {
    const missingIds = Array.from(new Set(items.flatMap((i) => i.tripIds))).filter((id) => !tripsById[id]);
    if (missingIds.length === 0) return;
    void (async () => {
      const fetched = await Promise.all(missingIds.map((id) => tripService.getById(id)));
      setTripsById((prev) => {
        const next = { ...prev };
        fetched.forEach((trip, idx) => {
          if (trip) next[missingIds[idx]] = trip;
        });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const fetchPeriod = async () => {
    // showLoading/hideLoading ở đây có thể lồng với vòng loading riêng của onLock/onMarkPaid/
    // onConfirmUnlock (những nơi đó cũng bọc showLoading quanh cả thao tác lẫn lần gọi fetchPeriod
    // này) — vô hại vì cùng 1 overlay toàn màn hình giống hệt nhau, và đây là chỗ DUY NHẤT xử lý lần
    // tải đầu tiên khi mới vào trang (trước đây không hiện loading, trang trắng trong lúc chờ).
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const p = await payrollPeriodService.getById(periodId);
      if (!p) {
        await alert({ title: "Lỗi", content: "Không tìm thấy kỳ lương này" });
        router.push("/tai-chinh/luong-tai-xe");
        return;
      }
      setPeriod(p);
      setItems(p.items);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Tải kỳ lương thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
      setLoadingPeriod(false);
    }
  };

  useEffect(() => {
    void fetchPeriod();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  useEffect(() => {
    if (!period) return;
    if (period.items.length > 0) {
      setSelectedDriverIds(period.items.map((i) => i.driverId));
    } else if (drivers.length > 0 && selectedDriverIds.length === 0) {
      setSelectedDriverIds(drivers.filter((d) => d.status === "ACTIVE").map((d) => d.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, drivers]);

  const driverOptions = drivers
    .filter((d) => d.status === "ACTIVE" || selectedDriverIds.includes(d.id))
    .map((d) => ({ value: d.id, label: d.name }));
  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name ?? id;

  const saveAdvance = async () => {
    const amount = advanceAmount;
    if (!advanceDriverId || !amount || amount <= 0) {
      await alert({ title: "Lỗi", content: "Vui lòng nhập số tiền ứng hợp lệ" });
      return;
    }
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const transactionNo = await generateTransactionNo("PAYMENT", advanceDate);
      await financeTransactionService.create({
        transactionNo, transactionDate: advanceDate, type: "PAYMENT", objectType: "DRIVER",
        objectId: advanceDriverId, amount, paymentMethod: "CASH",
        description: `Ứng lương trực tiếp - ${driverName(advanceDriverId)}`, status: "ACTIVE",
      }, user?.id ?? "");
      await alert({ title: "Thành công", content: `Đã tạo phiếu chi ${transactionNo}` });
      setAdvanceDriverId(null);
      setAdvanceAmount(0);
      await fetchPeriod();
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Tạo ứng lương thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const isLocked = period?.status === "LOCKED" || period?.status === "PAID";
  const canUpdate = can("payroll", "UPDATE") && !isLocked;
  const canLock = can("payroll", "LOCK");
  const canUnlock = can("payroll", "UNLOCK");

  const totals = useMemo(() => computePayrollPeriodTotals(items), [items]);
  const printItems = printingDriverId
    ? items.filter((i) => i.driverId === printingDriverId)
    : items.filter((i) => !excludedFromPrint.has(i.driverId));
  const printTotals = useMemo(() => computePayrollPeriodTotals(printItems), [printItems]);

  const updateRow = (driverId: string, patch: Partial<Pick<PayrollItem, "baseSalary" | "adjustment" | "adjustmentNote">>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.driverId !== driverId) return item;
        const next = { ...item, ...patch };
        return { ...next, netAmount: computePayrollItemNet(next) };
      })
    );
  };

  const onCalculate = async () => {
    if (!period) return;
    if (selectedDriverIds.length === 0) {
      await alert({ title: "Cảnh báo", content: "Vui lòng chọn ít nhất 1 tài xế." });
      return;
    }
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const existingByDriver = new Map(items.map((i) => [i.driverId, i]));
      const inputs = selectedDriverIds.map((driverId) => {
        const existing = existingByDriver.get(driverId);
        const driver = drivers.find((d) => d.id === driverId);
        return {
          driverId,
          baseSalary: existing?.baseSalary ?? driver?.baseSalary ?? 0,
          adjustment: existing?.adjustment ?? 0,
          adjustmentNote: existing?.adjustmentNote,
        };
      });
      const newItems = await calculatePayrollPeriodItems(
        inputs,
        { fromDate: period.fromDate, toDate: period.toDate },
        period.id
      );
      await payrollPeriodService.update(period.id, { items: newItems, status: "CALCULATED" }, user?.id ?? "");
      setItems(newItems);
      setPeriod({ ...period, items: newItems, status: "CALCULATED" });
      await alert({ title: "Thành công", content: "Đã tính lương theo chuyến + phiếu ứng cho các tài xế đã chọn." });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Tính lương thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onSaveAdjustments = async () => {
    if (!period) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await payrollPeriodService.update(period.id, { items }, user?.id ?? "");
      setPeriod({ ...period, items });
      await alert({ title: "Thành công", content: "Đã lưu điều chỉnh lương." });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lưu thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onRemoveDriver = async (driverId: string) => {
    if (!period || !canUpdate) return;
    const driver = driverName(driverId);
    const isConfirm = await confirm({
      title: "Xóa tài xế khỏi phiếu lương",
      content: `Xóa ${driver} khỏi kỳ lương này? Các chuyến đã tính của tài xế sẽ không còn thuộc kỳ lương.`,
    });
    if (!isConfirm) return;
    const nextItems = items.filter((item) => item.driverId !== driverId);
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await payrollPeriodService.update(period.id, { items: nextItems }, user?.id ?? "");
      setItems(nextItems);
      setSelectedDriverIds((prev) => prev.filter((id) => id !== driverId));
      setPeriod({ ...period, items: nextItems });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Xóa tài xế khỏi kỳ lương thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onLock = async () => {
    if (!period) return;
    const isConfirm = await confirm({
      title: "Xác nhận chốt kỳ lương",
      content: "Sau khi chốt sẽ không thể sửa trực tiếp — muốn sửa phải mở khóa và ghi lý do. Tiếp tục?",
    });
    if (!isConfirm) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await payrollPeriodService.update(
        period.id,
        { status: "LOCKED", lockedAt: new Date().toISOString(), lockedBy: user?.id ?? "" },
        user?.id ?? ""
      );
      await fetchPeriod();
      await alert({ title: "Thành công", content: "Đã chốt kỳ lương." });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Chốt kỳ lương thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onMarkPaid = async () => {
    if (!period) return;
    const isConfirm = await confirm({ title: "Xác nhận", content: "Đánh dấu kỳ lương này đã trả cho tài xế?" });
    if (!isConfirm) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await payrollPeriodService.update(period.id, { status: "PAID" }, user?.id ?? "");
      await fetchPeriod();
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Cập nhật thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onConfirmUnlock = async () => {
    if (!period) return;
    if (!unlockReason.trim()) {
      await alert({ title: "Cảnh báo", content: "Vui lòng nhập lý do mở khóa." });
      return;
    }
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await payrollPeriodService.update(
        period.id,
        {
          status: "CALCULATED",
          unlockReason: unlockReason.trim(),
          unlockedAt: new Date().toISOString(),
          unlockedBy: user?.id ?? "",
        },
        user?.id ?? ""
      );
      setShowUnlockBox(false);
      setUnlockReason("");
      await fetchPeriod();
      await alert({ title: "Thành công", content: "Đã mở khóa kỳ lương — có thể sửa lại." });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Mở khóa thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onExportExcel = async (onlyDriverId?: string) => {
    if (!period) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      // Xuất Excel cả kỳ (không chọn riêng 1 tài xế) tôn trọng đúng ô tick loại tài xế như "In bảng
      // lương" — cùng 1 khái niệm phạm vi, tránh 2 nút ra 2 kết quả khác nhau khó hiểu.
      const scopedItems = onlyDriverId ? items : items.filter((i) => !excludedFromPrint.has(i.driverId));
      await exportPayrollPeriodToExcel({ period, items: scopedItems, tripsById, driverName, routeName, onlyDriverId });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Xuất Excel thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  if (loadingPeriod || !period) return null;

  return (
    <>
      <div className="hidden print:block">
        <PrintHeader
          title={
            printingDriverId
              ? `Phiếu lương — ${driverName(printingDriverId)} — Kỳ ${period.periodCode}`
              : `Bảng lương tài xế — Kỳ ${period.periodCode}`
          }
          company={company}
        />
        <p className="text-sm mb-2">
          Từ ngày {period.fromDate} đến ngày {period.toDate}
        </p>
        {printItems.map((item) => {
          const trips = item.tripIds.map((id) => tripsById[id]).filter((t): t is Trip => Boolean(t));
          return (
            <div key={item.driverId} className="mb-3 break-inside-avoid">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="text-left py-1 px-2">Tài xế</th>
                    <th className="text-right py-1 px-2">Lương cơ bản</th>
                    <th className="text-right py-1 px-2">Lương chuyến</th>
                    <th className="text-right py-1 px-2">Ứng lương</th>
                    <th className="text-right py-1 px-2">Điều chỉnh</th>
                    <th className="text-right py-1 px-2">Thực nhận</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-300 font-semibold">
                    <td className="py-1 px-2">{driverName(item.driverId)}</td>
                    <td className="text-right py-1 px-2">{currencyFormatter.format(item.baseSalary)}</td>
                    <td className="text-right py-1 px-2">{currencyFormatter.format(item.tripSalary)}</td>
                    <td className="text-right py-1 px-2">{currencyFormatter.format(item.advance)}</td>
                    <td className="text-right py-1 px-2">{currencyFormatter.format(item.adjustment)}</td>
                    <td className="text-right py-1 px-2">{currencyFormatter.format(item.netAmount)}</td>
                  </tr>
                </tbody>
              </table>
              {trips.length > 0 && (
                <table className="w-[calc(100%-1rem)] ml-4 text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left py-0.5 px-1.5 font-normal">Mã chuyến</th>
                      <th className="text-left py-0.5 px-1.5 font-normal">Ngày</th>
                      <th className="text-left py-0.5 px-1.5 font-normal">Tuyến</th>
                      <th className="text-right py-0.5 px-1.5 font-normal">Lương chuyến</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.id} className="border-b border-dotted border-gray-300">
                        <td className="py-0.5 px-1.5">{trip.tripCode}</td>
                        <td className="py-0.5 px-1.5">{trip.tripDate}</td>
                        <td className="py-0.5 px-1.5">{routeName(trip)}</td>
                        <td className="text-right py-0.5 px-1.5">{currencyFormatter.format(trip.driverTripSalary || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-medium">
                      <td colSpan={3} className="text-right py-0.5 px-1.5">
                        Tổng lương chuyến ({trips.length} chuyến):
                      </td>
                      <td className="text-right py-0.5 px-1.5">{currencyFormatter.format(item.tripSalary)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          );
        })}
        {!printingDriverId && (
          <table className="w-full text-sm border-collapse mt-2">
            <tfoot>
              <tr className="border-t-2 border-black font-semibold">
                <td className="py-1 px-2">Tổng cộng</td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(printTotals.totalBaseSalary)}</td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(printTotals.totalTripSalary)}</td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(printTotals.totalAdvance)}</td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(printTotals.totalAdjustment)}</td>
                <td className="text-right py-1 px-2">{currencyFormatter.format(printTotals.totalNet)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <PrintSignatureBlock partyLabel="Xác nhận của tài xế" company={company} />
      </div>

      <div className="print:hidden flex flex-col gap-6 pb-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Kỳ lương {period.periodCode}</h4>
          <p className="text-sm text-gray-400">
            {period.fromDate} → {period.toDate}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PayrollStatusBadge status={period.status} />
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" /> In bảng lương
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void onExportExcel()} className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </Button>
        </div>
      </div>

      {period.unlockReason && (
        <div className="rounded-lg border border-warning-500 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:bg-warning-500/10">
          Lần mở khóa gần nhất: <strong>{period.unlockReason}</strong>
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div>
          <p className="text-xs text-gray-400">Lương cơ bản</p>
          <p className="text-base font-semibold text-gray-800 dark:text-white/90">{currencyFormatter.format(totals.totalBaseSalary)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Lương chuyến</p>
          <p className="text-base font-semibold text-gray-800 dark:text-white/90">{currencyFormatter.format(totals.totalTripSalary)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Ứng lương</p>
          <p className="text-base font-semibold text-error-500">{currencyFormatter.format(totals.totalAdvance)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Điều chỉnh</p>
          <p className="text-base font-semibold text-gray-800 dark:text-white/90">{currencyFormatter.format(totals.totalAdjustment)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Thực nhận</p>
          <p className="text-lg font-semibold text-success-600">{currencyFormatter.format(totals.totalNet)}</p>
        </div>
      </section>

      {canUpdate && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Chọn tài xế để tính lương</h4>
            <Button type="button" variant="default" size="sm" onClick={() => void onCalculate()}>
              Tính lương
            </Button>
          </div>
          <MultiSelect
            options={driverOptions}
            value={selectedDriverIds}
            onChange={setSelectedDriverIds}
            placeholder="Chọn tài xế"
            className="w-full"
          />
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-3">Chi tiết lương từng tài xế</h4>
        {items.length === 0 && <p className="text-sm text-gray-400">Chưa tính lương — chọn tài xế và bấm &quot;Tính lương&quot; ở trên.</p>}
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.driverId} className="grid grid-cols-1 sm:grid-cols-6 gap-2 sm:gap-3 items-start border-b pb-2 sm:pb-3 last:border-b-0">
              <div className="sm:col-span-2 min-w-0">
                <Label className="whitespace-nowrap">Tài xế</Label>
                <div className="min-h-8 flex flex-wrap items-center gap-x-1 gap-y-1">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Checkbox
                      checked={!excludedFromPrint.has(item.driverId)}
                      onCheckedChange={(checked) => toggleExcludedFromPrint(item.driverId, checked === true)}
                      title="Bỏ chọn để không đưa tài xế này vào In bảng lương / Xuất Excel cả kỳ"
                    />
                    <p className="font-medium text-gray-800 dark:text-white/90 truncate">{driverName(item.driverId)}</p>
                  </div>
                  <div className="flex w-full items-center gap-1 sm:w-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 flex items-center gap-1"
                      onClick={() => setPrintingDriverId(item.driverId)}
                    >
                      <Printer className="h-3.5 w-3.5" /> In phiếu
                    </Button>
                    {canUpdate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 flex items-center gap-1 text-error-600 hover:text-error-700"
                        onClick={() => void onRemoveDriver(item.driverId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Xóa
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 flex items-center gap-1"
                      onClick={() => void onExportExcel(item.driverId)}
                    >
                      <Download className="h-3.5 w-3.5" /> Excel
                    </Button>
                    {canUpdate && (
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 flex items-center gap-1"
                        onClick={() => { setAdvanceDriverId(item.driverId); setAdvanceDate(new Date().toISOString().slice(0, 10)); }}>
                        <Wallet className="h-3.5 w-3.5" /> Ứng
                      </Button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                  onClick={() => toggleExpanded(item.driverId)}
                >
                  {item.tripIds.length} chuyến trong kỳ
                </button>
              </div>
              {expandedDriverIds.has(item.driverId) && (
                <div className="sm:col-span-6 rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {item.tripIds.length === 0 ? (
                    <p className="text-xs text-gray-400 p-2">Không có chuyến nào trong kỳ.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="text-left p-1.5 font-medium">Mã chuyến</th>
                          <th className="text-left p-1.5 font-medium">Ngày</th>
                          <th className="text-left p-1.5 font-medium">Tuyến</th>
                          <th className="text-right p-1.5 font-medium">Lương chuyến</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.tripIds
                          .map((id) => tripsById[id])
                          .filter((t): t is Trip => Boolean(t))
                          .map((trip) => (
                            <tr key={trip.id} className="border-t border-gray-100 dark:border-gray-800">
                              <td className="p-1.5">{trip.tripCode}</td>
                              <td className="p-1.5">{trip.tripDate}</td>
                              <td className="p-1.5">{routeName(trip)}</td>
                              <td className="p-1.5 text-right">{currencyFormatter.format(trip.driverTripSalary || 0)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              <div>
                <Label className="whitespace-nowrap">Lương cơ bản</Label>
                <CurrencyInput
                  disabled={!canUpdate}
                  value={item.baseSalary}
                  onChange={(value) => updateRow(item.driverId, { baseSalary: value })}
                />
              </div>
              <div>
                <Label className="whitespace-nowrap">Lương chuyến</Label>
                <p className="h-8 flex items-center">{currencyFormatter.format(item.tripSalary)}</p>
              </div>
              <div>
                <Label className="whitespace-nowrap">Ứng lương</Label>
                <p className="h-8 flex items-center text-error-500">{currencyFormatter.format(item.advance)}</p>
              </div>
              <div>
                <Label className="whitespace-nowrap">Điều chỉnh (+/-)</Label>
                <CurrencyInput
                  allowNegative
                  disabled={!canUpdate}
                  value={item.adjustment}
                  onChange={(value) => updateRow(item.driverId, { adjustment: value })}
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="whitespace-nowrap">Ghi chú điều chỉnh</Label>
                <Input
                  disabled={!canUpdate}
                  value={item.adjustmentNote ?? ""}
                  onChange={(e) => updateRow(item.driverId, { adjustmentNote: e.target.value })}
                  placeholder="Vd: thưởng an toàn, phạt trễ giờ..."
                />
              </div>
              <div className="sm:col-span-3 text-right">
                <Label className="whitespace-nowrap">Thực nhận</Label>
                <p className="h-8 flex items-center justify-end text-base font-semibold text-success-600">
                  {currencyFormatter.format(item.netAmount)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {advanceDriverId && (
        <Dialog open={true} onOpenChange={(open) => !open && setAdvanceDriverId(null)}>
          <DialogContent className="bg-white p-4">
            <DialogHeader><DialogTitle>Ghi nhận ứng lương</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <p className="text-sm">Tài xế: <strong>{driverName(advanceDriverId)}</strong></p>
              <div><Label>Ngày chi</Label><Input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} /></div>
              <div><Label>Số tiền</Label><CurrencyInput min={1} value={advanceAmount} onChange={setAdvanceAmount} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAdvanceDriverId(null)}>Hủy</Button><Button onClick={() => void saveAdvance()}>Lưu</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showUnlockBox && (
        <section className="rounded-2xl border border-warning-500 bg-warning-50 p-4 dark:bg-warning-500/10">
          <Label className="whitespace-nowrap">
            Lý do mở khóa <span className="text-error-500">*</span>
          </Label>
          <Textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} className="mt-1" />
          <div className="flex justify-end gap-2 mt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowUnlockBox(false)}>
              Hủy
            </Button>
            <Button type="button" variant="default" size="sm" onClick={() => void onConfirmUnlock()}>
              Xác nhận mở khóa
            </Button>
          </div>
        </section>
      )}

      <div className="flex justify-end gap-2 flex-wrap">
        <Button type="button" variant="outline" onClick={() => router.push("/tai-chinh/luong-tai-xe")}>
          Quay lại
        </Button>
        {canUpdate && items.length > 0 && (
          <Button type="button" variant="outline" onClick={() => void onSaveAdjustments()}>
            Lưu điều chỉnh
          </Button>
        )}
        {canLock && period.status === "CALCULATED" && items.length > 0 && (
          <Button type="button" variant="default" onClick={() => void onLock()}>
            Chốt kỳ lương
          </Button>
        )}
        {canLock && period.status === "LOCKED" && (
          <Button type="button" variant="default" onClick={() => void onMarkPaid()}>
            Đánh dấu đã trả
          </Button>
        )}
        {canUnlock && isLocked && !showUnlockBox && (
          <Button type="button" variant="outline" onClick={() => setShowUnlockBox(true)}>
            Mở khóa
          </Button>
        )}
      </div>
      </div>
    </>
  );
}
