import { BaseEntity } from "./common";

export type TripStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "RECONCILED" | "CANCELLED";

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  DRAFT: "Nháp",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  RECONCILED: "Đã đối soát",
  CANCELLED: "Đã hủy",
};

/** Một dòng hàng hóa trong chuyến (mục 5.2). unitPrice = đơn giá theo chuyến, tra từ bảng giá. */
export interface TripItem {
  id: string;
  productId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** = quantity * unitPrice, luôn tính lại bởi computeTripTotals(), không nhập tay. */
  amount: number;
  dropFee?: number;
}

/** Một dòng chi phí phát sinh trong lúc chạy chuyến (mục 5.3). */
export interface TripCost {
  id: string;
  costTypeId: string;
  amount: number;
  description?: string;
  /** yyyy-MM-dd */
  transactionDate: string;
  /** Copy từ CostType.isFuel lúc thêm dòng — dùng để tính fuelActualAmount (mục 5.5). */
  isFuel: boolean;
}

export interface Trip extends Omit<BaseEntity, "status"> {
  status: TripStatus;
  tripCode: string;
  /** yyyy-MM-dd */
  tripDate: string;
  customerId: string;
  vendorId?: string;
  vehicleId: string;
  driverId: string;
  lot?: string;
  pickupLocationId: string;
  dropoffLocationId: string;

  /** Bảng giá đã dùng để chốt giá chuyến (truy vết nguồn giá, mục 5.1). */
  priceListId?: string;
  /** Snapshot từ TransportPrice tại thời điểm chốt chuyến — không đổi theo bảng giá sau này. */
  driverTripSalary: number;
  vendorCost: number;
  fuelNormAmount: number;

  items: TripItem[];
  costs: TripCost[];

  /** Các field dưới đây luôn được ghi đè bởi computeTripTotals() khi lưu (mục 7, 8, 9, 42). */
  revenue: number;
  fuelActualAmount: number;
  fuelVarianceAmount: number;
  cost: number;
  profit: number;
}
