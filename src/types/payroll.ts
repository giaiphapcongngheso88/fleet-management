import { BaseEntity } from "./common";

export type PayrollPeriodStatus = "DRAFT" | "CALCULATED" | "LOCKED" | "PAID";

export const PAYROLL_PERIOD_STATUS_LABEL: Record<PayrollPeriodStatus, string> = {
  DRAFT: "Nháp",
  CALCULATED: "Đã tính lương",
  LOCKED: "Đã chốt",
  PAID: "Đã trả lương",
};

/** 1 dòng lương của 1 tài xế trong kỳ (mục 25.2, 26). */
export interface PayrollItem {
  driverId: string;
  /** Mặc định lấy từ Driver.baseSalary lúc "Tính lương", có thể sửa tay. */
  baseSalary: number;
  /** SUM(Trip.driverTripSalary) các chuyến COMPLETED/RECONCILED trong kỳ — snapshot lúc "Tính lương". */
  tripSalary: number;
  /** SUM(FinanceTransaction loại Phiếu chi, đối tượng Tài xế) trong khoảng ngày của kỳ — snapshot lúc "Tính lương". */
  advance: number;
  /** Thưởng - phạt + phụ cấp, nhập tay (mục 25.2). */
  adjustment: number;
  adjustmentNote?: string;
  /** = baseSalary + tripSalary + adjustment - advance, luôn tính lại bởi computePayrollItemNet(). */
  netAmount: number;
  /** Các chuyến đã tính vào kỳ này — chống lấy trùng chuyến giữa các kỳ (mục 45). */
  tripIds: string[];
}

export interface PayrollPeriod extends Omit<BaseEntity, "status"> {
  status: PayrollPeriodStatus;
  /** yyyy-MM, mỗi tháng chỉ có đúng 1 kỳ lương. */
  periodCode: string;
  /** yyyy-MM-dd — ngày đầu/cuối kỳ, dùng để lọc chuyến + phiếu ứng lương. */
  fromDate: string;
  toDate: string;
  items: PayrollItem[];
  lockedAt?: string;
  lockedBy?: string;
  /** Lý do mở khóa lần gần nhất (mục 27 — mọi lần mở khóa phải ghi lý do). */
  unlockReason?: string;
  unlockedAt?: string;
  unlockedBy?: string;
}
