import { BaseEntity } from "./common";

/**
 * Bảng giá vận chuyển (mục 17 đặc tả nghiệp vụ).
 * Khóa tra cứu giá: customerId + pickupLocationId + dropoffLocationId + productId + ngày.
 */
export interface TransportPrice extends BaseEntity {
  customerId: string;
  pickupLocationId: string;
  dropoffLocationId: string;
  productId: string;
  unit: string;
  salesPrice: number;
  dropFee: number;
  vendorCost: number;
  driverTripSalary: number;
  ticketFee: number;
  otherFee: number;
  /** yyyy-MM-dd */
  effectiveFrom: string;
  /** yyyy-MM-dd, để trống = không giới hạn ngày kết thúc */
  effectiveTo?: string;
}
