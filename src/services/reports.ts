import { CostType } from "@/types/cost-type";
import { FinanceTransaction } from "@/types/finance";
import { Customer, Driver, Location, Product, Vehicle } from "@/types/master-data";
import { Trip, TripStatus } from "@/types/trip";
import { differenceInCalendarDays, format, parseISO, subDays, subMonths } from "date-fns";

/** Chuyến được công nhận doanh thu/chi phí (mục 29-31) — cùng bộ trạng thái với Công nợ (mục 21, 23). */
const REPORT_TRIP_STATUSES: TripStatus[] = ["COMPLETED", "RECONCILED"];

export function filterTripsInRange(trips: Trip[], fromDate: string, toDate: string): Trip[] {
  return trips.filter(
    (t) => REPORT_TRIP_STATUSES.includes(t.status) && t.tripDate >= fromDate && t.tripDate <= toDate
  );
}

export function filterTransactionsInRange(
  transactions: FinanceTransaction[],
  fromDate: string,
  toDate: string
): FinanceTransaction[] {
  return transactions.filter(
    (t) => t.status === "ACTIVE" && t.transactionDate >= fromDate && t.transactionDate <= toDate
  );
}

export interface OverallSummary {
  tripCount: number;
  revenue: number;
  cost: number;
  profit: number;
  totalReceipt: number;
  totalPayment: number;
  balance: number;
  totalReceivable: number;
  totalPayable: number;
}

/**
 * Báo cáo tổng hợp (mục 32). Chống tính trùng chi phí (mục 30): Trip.cost đã gồm cước thuê xe +
 * lương tài xế/chuyến + chi phí phát sinh — phiếu thu/chi gắn KHÁCH HÀNG/ĐV VẬN TẢI/TÀI XẾ chỉ là
 * dòng tiền thanh toán lại khoản đã ghi nhận ở Trip, nên KHÔNG cộng thêm; chỉ phiếu chi đối tượng
 * "Khác" (không gắn chuyến/đối tượng cụ thể) mới là chi phí phát sinh mới, được cộng thêm.
 * Công nợ phải thu/phải trả là số dư lũy kế (mục 21.2, 23.2) — không lọc theo khoảng ngày báo cáo.
 */
export function computeOverallSummary(params: {
  tripsInRange: Trip[];
  transactionsInRange: FinanceTransaction[];
  allTrips: Trip[];
  allTransactions: FinanceTransaction[];
}): OverallSummary {
  const { tripsInRange, transactionsInRange, allTrips, allTransactions } = params;

  const revenue = tripsInRange.reduce((s, t) => s + (t.revenue || 0), 0);
  const otherCost = transactionsInRange
    .filter((t) => t.type === "PAYMENT" && t.objectType === "OTHER")
    .reduce((s, t) => s + t.amount, 0);
  const cost = tripsInRange.reduce((s, t) => s + (t.cost || 0), 0) + otherCost;

  const totalReceipt = transactionsInRange.filter((t) => t.type === "RECEIPT").reduce((s, t) => s + t.amount, 0);
  const totalPayment = transactionsInRange.filter((t) => t.type === "PAYMENT").reduce((s, t) => s + t.amount, 0);

  const settledTrips = allTrips.filter((t) => REPORT_TRIP_STATUSES.includes(t.status));
  const activeTransactions = allTransactions.filter((t) => t.status === "ACTIVE");
  const totalRevenueAllTime = settledTrips.reduce((s, t) => s + (t.revenue || 0), 0);
  const totalVendorCostAllTime = settledTrips.reduce((s, t) => s + (t.vendorCost || 0), 0);
  const totalReceiptFromCustomers = activeTransactions
    .filter((t) => t.type === "RECEIPT" && t.objectType === "CUSTOMER")
    .reduce((s, t) => s + t.amount, 0);
  const totalPaymentToVendors = activeTransactions
    .filter((t) => t.type === "PAYMENT" && t.objectType === "VENDOR")
    .reduce((s, t) => s + t.amount, 0);

  return {
    tripCount: tripsInRange.length,
    revenue,
    cost,
    profit: revenue - cost,
    totalReceipt,
    totalPayment,
    balance: totalReceipt - totalPayment,
    totalReceivable: totalRevenueAllTime - totalReceiptFromCustomers,
    totalPayable: totalVendorCostAllTime - totalPaymentToVendors,
  };
}

/**
 * Kỳ liền trước, cùng số ngày với kỳ đang xem — dùng để so sánh tăng/giảm (mục 33 "biểu đồ theo
 * tháng" mở rộng: so sánh kỳ hiện tại với kỳ liền trước cùng độ dài).
 */
export function getPreviousRange(fromDate: string, toDate: string): { from: string; to: string } {
  const from = parseISO(fromDate);
  const to = parseISO(toDate);
  const days = differenceInCalendarDays(to, from) + 1;
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, days - 1);
  return { from: format(prevFrom, "yyyy-MM-dd"), to: format(prevTo, "yyyy-MM-dd") };
}

/** % tăng/giảm so với kỳ trước — null khi kỳ trước bằng 0 và kỳ này cũng bằng 0 (không có gì để so sánh). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : current > 0 ? 100 : -100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export interface MonthlyTrendRow {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
}

/** Doanh thu/chi phí/lợi nhuận theo tháng (mục 33 biểu đồ) — luôn đủ N tháng gần nhất, kể cả tháng 0 chuyến. */
export function computeMonthlyTrend(trips: Trip[], monthsBack: number): MonthlyTrendRow[] {
  const settled = trips.filter((t) => REPORT_TRIP_STATUSES.includes(t.status));
  const now = new Date();
  const months = Array.from({ length: monthsBack }, (_, i) => format(subMonths(now, monthsBack - 1 - i), "yyyy-MM"));

  const byMonth = new Map<string, MonthlyTrendRow>(months.map((m) => [m, { month: m, revenue: 0, cost: 0, profit: 0 }]));
  for (const t of settled) {
    const row = byMonth.get(t.tripDate.slice(0, 7));
    if (!row) continue;
    row.revenue += t.revenue || 0;
    row.cost += t.cost || 0;
    row.profit += t.profit || 0;
  }
  return months.map((m) => byMonth.get(m)!);
}

export type TripDimension = "day" | "month" | "customer" | "vehicle" | "driver" | "trip" | "route";

export const TRIP_DIMENSION_LABEL: Record<TripDimension, string> = {
  day: "Theo ngày",
  month: "Theo tháng",
  customer: "Theo khách hàng",
  vehicle: "Theo xe",
  driver: "Theo tài xế",
  trip: "Theo chuyến",
  route: "Theo tuyến",
};

export interface TripGroupRow {
  key: string;
  label: string;
  tripCount: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface TripGroupRefs {
  customers: Customer[];
  vehicles: Vehicle[];
  drivers: Driver[];
  locations: Location[];
}

/** Gom nhóm chuyến theo 1 chiều xem (mục 29, 31) — dùng chung cho tab Doanh thu và Lợi nhuận. */
export function groupTrips(trips: Trip[], dimension: TripDimension, refs: TripGroupRefs): TripGroupRow[] {
  const { customers, vehicles, drivers, locations } = refs;
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  const keyOf = (t: Trip): { key: string; label: string } => {
    switch (dimension) {
      case "day":
        return { key: t.tripDate, label: t.tripDate };
      case "month": {
        const month = t.tripDate.slice(0, 7);
        return { key: month, label: month };
      }
      case "customer": {
        const c = customers.find((x) => x.id === t.customerId);
        return { key: t.customerId, label: c ? `${c.code} - ${c.name}` : t.customerId };
      }
      case "vehicle": {
        const v = vehicles.find((x) => x.id === t.vehicleId);
        return { key: t.vehicleId, label: v?.licensePlate ?? t.vehicleId };
      }
      case "driver": {
        const d = drivers.find((x) => x.id === t.driverId);
        return { key: t.driverId, label: d?.name ?? t.driverId };
      }
      case "trip":
        return { key: t.id, label: t.tripCode };
      case "route": {
        const key = `${t.pickupLocationId}|${t.dropoffLocationId}`;
        return { key, label: `${locationName(t.pickupLocationId)} → ${locationName(t.dropoffLocationId)}` };
      }
    }
  };

  const map = new Map<string, TripGroupRow>();
  for (const t of trips) {
    const { key, label } = keyOf(t);
    const row = map.get(key) ?? { key, label, tripCount: 0, revenue: 0, cost: 0, profit: 0 };
    row.tripCount += 1;
    row.revenue += t.revenue || 0;
    row.cost += t.cost || 0;
    row.profit += t.profit || 0;
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export interface ProductRevenueRow {
  key: string;
  label: string;
  quantity: number;
  revenue: number;
}

/** Doanh thu theo hàng hóa (mục 29) — gom từ TripItem, không có ở cấp Trip nên tách riêng. */
export function groupRevenueByProduct(trips: Trip[], products: Product[]): ProductRevenueRow[] {
  const map = new Map<string, ProductRevenueRow>();
  for (const t of trips) {
    for (const item of t.items) {
      const product = products.find((p) => p.id === item.productId);
      const label = product?.name ?? item.productId;
      const row = map.get(item.productId) ?? { key: item.productId, label, quantity: 0, revenue: 0 };
      row.quantity += item.quantity || 0;
      row.revenue += (item.amount || 0) + (item.dropFee || 0);
      map.set(item.productId, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export interface CostTypeRow {
  key: string;
  label: string;
  amount: number;
}

const VENDOR_COST_KEY = "__vendor_cost__";
const DRIVER_SALARY_KEY = "__driver_salary__";
const OTHER_COST_KEY = "__other__";

/**
 * Chi phí theo loại (mục 30) — gom từ TripCost + 2 khoản snapshot theo chuyến (cước thuê xe, lương
 * tài xế/chuyến) không nằm trong TripCost + phiếu chi "Khác" không gắn chuyến/đối tượng cụ thể.
 */
export function groupCostByType(
  trips: Trip[],
  transactions: FinanceTransaction[],
  costTypes: CostType[]
): CostTypeRow[] {
  const map = new Map<string, CostTypeRow>();
  const add = (key: string, label: string, amount: number) => {
    if (!amount) return;
    const row = map.get(key) ?? { key, label, amount: 0 };
    row.amount += amount;
    map.set(key, row);
  };

  for (const t of trips) {
    add(VENDOR_COST_KEY, "Cước thuê đơn vị vận tải", t.vendorCost || 0);
    add(DRIVER_SALARY_KEY, "Lương tài xế theo chuyến", t.driverTripSalary || 0);
    for (const c of t.costs) {
      const costType = costTypes.find((ct) => ct.id === c.costTypeId);
      add(c.costTypeId, costType?.name ?? c.costTypeId, c.amount || 0);
    }
  }
  for (const tx of transactions) {
    if (tx.type !== "PAYMENT" || tx.objectType !== "OTHER" || tx.status !== "ACTIVE") continue;
    const costType = costTypes.find((ct) => ct.id === tx.costTypeId);
    add(tx.costTypeId ?? OTHER_COST_KEY, costType?.name ?? "Chi phí khác", tx.amount);
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}
