import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createCrudService } from "@/lib/firestoreCrud";
import { FinanceTransaction } from "@/types/finance";
import { PayrollItem, PayrollPeriod } from "@/types/payroll";
import { Trip, TripStatus } from "@/types/trip";

// Dữ liệu giao dịch — KHÔNG bật cache (mục 2.4: chỉ cache danh mục/bảng giá).
export const payrollPeriodService = createCrudService<PayrollPeriod>("payroll_periods");

const SALARY_TRIP_STATUSES: TripStatus[] = ["COMPLETED", "RECONCILED"];

export function periodCodeOf(monthDate: string): string {
  return monthDate.slice(0, 7);
}

/**
 * Toàn bộ tripId đã được tính vào bất kỳ kỳ lương nào khác — chống lấy trùng chuyến (mục 45:
 * "Không lấy trùng chuyến"). Loại trừ chính kỳ đang tính để cho phép tính lại nhiều lần trên cùng 1 kỳ.
 */
async function getTripIdsUsedByOtherPeriods(excludePeriodId?: string): Promise<Set<string>> {
  const periods = await payrollPeriodService.getAll();
  const ids = new Set<string>();
  for (const period of periods) {
    if (period.id === excludePeriodId) continue;
    for (const item of period.items) {
      for (const tripId of item.tripIds) ids.add(tripId);
    }
  }
  return ids;
}

export interface DriverPayrollInput {
  driverId: string;
  baseSalary: number;
  adjustment: number;
  adjustmentNote?: string;
}

/**
 * Tính lương 1 tài xế trong khoảng ngày của kỳ (mục 25.2, 26):
 * tripSalary = SUM(Trip.driverTripSalary) các chuyến COMPLETED/RECONCILED trong kỳ, chưa tính ở kỳ khác.
 * advance = SUM(FinanceTransaction Phiếu chi, đối tượng Tài xế) trong khoảng ngày của kỳ.
 */
export async function calculateDriverPayrollItem(
  input: DriverPayrollInput,
  range: { fromDate: string; toDate: string },
  tripIdsUsedByOtherPeriods: Set<string>
): Promise<PayrollItem> {
  const { driverId, baseSalary, adjustment, adjustmentNote } = input;
  const { fromDate, toDate } = range;

  const tripsSnap = await getDocs(query(collection(db, "trips"), where("driverId", "==", driverId)));
  const trips = tripsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Trip)
    .filter(
      (t) =>
        SALARY_TRIP_STATUSES.includes(t.status) &&
        t.tripDate >= fromDate &&
        t.tripDate <= toDate &&
        !tripIdsUsedByOtherPeriods.has(t.id)
    );
  const tripSalary = trips.reduce((sum, t) => sum + (t.driverTripSalary || 0), 0);
  const tripIds = trips.map((t) => t.id);

  const advanceSnap = await getDocs(
    query(
      collection(db, "finance_transactions"),
      where("objectType", "==", "DRIVER"),
      where("objectId", "==", driverId),
      where("type", "==", "PAYMENT")
    )
  );
  const advance = advanceSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FinanceTransaction)
    .filter((f) => f.status === "ACTIVE" && f.transactionDate >= fromDate && f.transactionDate <= toDate)
    .reduce((sum, f) => sum + f.amount, 0);

  return {
    driverId,
    baseSalary,
    tripSalary,
    advance,
    adjustment,
    // Firestore từ chối undefined lồng trong mảng (không như field cấp cao nhất của document,
    // omitUndefined() ở firestoreCrud.ts không dò được vào bên trong mảng items) — luôn dùng "".
    adjustmentNote: adjustmentNote ?? "",
    netAmount: computePayrollItemNet({ baseSalary, tripSalary, advance, adjustment }),
    tripIds,
  };
}

/** Tính lại toàn bộ items của 1 kỳ cho danh sách tài xế đã chọn — dùng cho nút "Tính lương". */
export async function calculatePayrollPeriodItems(
  drivers: DriverPayrollInput[],
  range: { fromDate: string; toDate: string },
  excludePeriodId?: string
): Promise<PayrollItem[]> {
  const usedTripIds = await getTripIdsUsedByOtherPeriods(excludePeriodId);
  return Promise.all(drivers.map((d) => calculateDriverPayrollItem(d, range, usedTripIds)));
}

/**
 * Thực nhận = Lương cơ bản + Lương chuyến + Điều chỉnh - Ứng lương (mục 25.2).
 * Hàm thuần — gọi lại mỗi khi sửa baseSalary/adjustment trên form để không lệch với dữ liệu đã lưu.
 */
export function computePayrollItemNet(item: {
  baseSalary: number;
  tripSalary: number;
  advance: number;
  adjustment: number;
}): number {
  return (item.baseSalary || 0) + (item.tripSalary || 0) + (item.adjustment || 0) - (item.advance || 0);
}

export interface PayrollPeriodTotals {
  totalBaseSalary: number;
  totalTripSalary: number;
  totalAdvance: number;
  totalAdjustment: number;
  totalNet: number;
}

export function computePayrollPeriodTotals(items: PayrollItem[]): PayrollPeriodTotals {
  return {
    totalBaseSalary: items.reduce((s, i) => s + (i.baseSalary || 0), 0),
    totalTripSalary: items.reduce((s, i) => s + (i.tripSalary || 0), 0),
    totalAdvance: items.reduce((s, i) => s + (i.advance || 0), 0),
    totalAdjustment: items.reduce((s, i) => s + (i.adjustment || 0), 0),
    totalNet: items.reduce((s, i) => s + (i.netAmount || 0), 0),
  };
}
