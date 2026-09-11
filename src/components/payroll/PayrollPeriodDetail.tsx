"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import useLoading from "@/components/loading";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/select/multi-select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { useReferenceData } from "@/hooks/useReferenceData";
import { driverService } from "@/services/master-data";
import {
  calculatePayrollPeriodItems,
  computePayrollItemNet,
  computePayrollPeriodTotals,
  payrollPeriodService,
} from "@/services/payroll";
import { Driver } from "@/types/master-data";
import { PayrollItem, PayrollPeriod } from "@/types/payroll";
import { getErrorMessage } from "@/utils/errorHandler";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export function PayrollPeriodDetail({ periodId }: { periodId: string }) {
  const router = useRouter();
  const { alert, confirm } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { can } = usePermission();
  const { user } = useCurrentUser();

  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [showUnlockBox, setShowUnlockBox] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  const drivers = useReferenceData<Driver>(() => driverService.getAll(), "tài xế");

  const fetchPeriod = async () => {
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

  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.name }));
  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name ?? id;

  const isLocked = period?.status === "LOCKED" || period?.status === "PAID";
  const canUpdate = can("payroll", "UPDATE") && !isLocked;
  const canLock = can("payroll", "LOCK");
  const canUnlock = can("payroll", "UNLOCK");

  const totals = useMemo(() => computePayrollPeriodTotals(items), [items]);

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

  if (loadingPeriod || !period) return null;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Kỳ lương {period.periodCode}</h4>
          <p className="text-sm text-gray-400">
            {period.fromDate} → {period.toDate}
          </p>
        </div>
        <PayrollStatusBadge status={period.status} />
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
            <div key={item.driverId} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end border-b pb-3 last:border-b-0">
              <div className="sm:col-span-2">
                <Label className="whitespace-nowrap">Tài xế</Label>
                <p className="h-8 flex items-center font-medium text-gray-800 dark:text-white/90">{driverName(item.driverId)}</p>
                <p className="text-xs text-gray-400">{item.tripIds.length} chuyến trong kỳ</p>
              </div>
              <div>
                <Label className="whitespace-nowrap">Lương cơ bản</Label>
                <Input
                  type="number"
                  disabled={!canUpdate}
                  value={item.baseSalary}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => updateRow(item.driverId, { baseSalary: e.target.valueAsNumber || 0 })}
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
                <Input
                  type="number"
                  disabled={!canUpdate}
                  value={item.adjustment}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => updateRow(item.driverId, { adjustment: e.target.valueAsNumber || 0 })}
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
  );
}
