import { BaseEntity } from "./common";

/** Thu - Chi (mục 18 spec). RECEIPT = Phiếu thu, PAYMENT = Phiếu chi. */
export type TransactionType = "RECEIPT" | "PAYMENT";

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  RECEIPT: "Phiếu thu",
  PAYMENT: "Phiếu chi",
};

export type TransactionObjectType = "CUSTOMER" | "VENDOR" | "DRIVER" | "OTHER";

export const TRANSACTION_OBJECT_TYPE_LABEL: Record<TransactionObjectType, string> = {
  CUSTOMER: "Khách hàng",
  VENDOR: "Đơn vị vận tải",
  DRIVER: "Tài xế",
  OTHER: "Khác",
};

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "OTHER";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  OTHER: "Khác",
};

export interface FinanceTransaction extends BaseEntity {
  transactionNo: string;
  /** yyyy-MM-dd */
  transactionDate: string;
  type: TransactionType;
  /** "category" mục 18.1 — dùng chung CostType (loại có isCashTransaction = true). */
  costTypeId?: string;
  objectType: TransactionObjectType;
  /** customerId | vendorId | driverId — để trống khi objectType = OTHER. */
  objectId?: string;
  /** Gắn với 1 chuyến cụ thể nếu phiếu này dùng để thanh toán công nợ đúng chuyến đó (mục 18.2/18.3). */
  tripId?: string;
  /** Khóa nguồn ổn định cho dữ liệu import từ Excel, dùng để chống tạo trùng khi upload lại. */
  sourceKey?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description?: string;
}
