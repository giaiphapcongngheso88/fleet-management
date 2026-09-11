import { format, parseISO } from "date-fns";
import { createCrudService } from "@/lib/firestoreCrud";
import { getNextSequence } from "@/lib/sequence";
import { Trip, TripCost, TripItem } from "@/types/trip";

export const tripService = createCrudService<Trip>("trips");

/** Sinh mã chuyến TRIP-yyyyMM-00001 (mục 43), số chạy theo từng tháng. */
export async function generateTripCode(tripDate: string): Promise<string> {
  const monthKey = format(parseISO(tripDate), "yyyyMM");
  const seq = await getNextSequence(`trip-${monthKey}`);
  return `TRIP-${monthKey}-${String(seq).padStart(5, "0")}`;
}

export interface TripTotals {
  revenue: number;
  fuelActualAmount: number;
  fuelVarianceAmount: number;
  cost: number;
  profit: number;
}

/**
 * Tính lại toàn bộ số liệu tài chính của chuyến (mục 7, 8, 9, 42, 5.5).
 * Hàm thuần — không đọc/ghi Firestore — để dễ gọi lại mỗi khi form thay đổi và dễ kiểm thử.
 *
 * revenue  = SUM(items.amount) + SUM(items.dropFee)
 * fuelActualAmount = SUM(costs where isFuel)
 * cost     = vendorCost + driverTripSalary + SUM(costs.amount)   -- đã gồm cả chi phí nhiên liệu
 * profit   = revenue - cost
 */
export function computeTripTotals(
  items: TripItem[],
  costs: TripCost[],
  snapshot: { vendorCost: number; driverTripSalary: number; fuelNormAmount: number }
): TripTotals {
  const revenue = items.reduce((sum, item) => sum + (item.amount || 0) + (item.dropFee || 0), 0);
  const fuelActualAmount = costs.filter((c) => c.isFuel).reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalCosts = costs.reduce((sum, c) => sum + (c.amount || 0), 0);
  const cost = (snapshot.vendorCost || 0) + (snapshot.driverTripSalary || 0) + totalCosts;
  const fuelVarianceAmount = fuelActualAmount - (snapshot.fuelNormAmount || 0);

  return {
    revenue,
    fuelActualAmount,
    fuelVarianceAmount,
    cost,
    profit: revenue - cost,
  };
}
