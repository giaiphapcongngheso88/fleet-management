import { BaseEntity } from "./common";

export type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "EXPIRED" | "CANCELLED";

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  APPROVED: "Đã duyệt",
  EXPIRED: "Hết hạn",
  CANCELLED: "Đã hủy",
};

/** 1 dòng báo giá (mục 28.2) — mỗi dòng có tuyến riêng, khác Trip (1 chuyến chỉ có 1 tuyến chung). */
export interface QuoteItem {
  id: string;
  pickupLocationId: string;
  dropoffLocationId: string;
  productId: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  /** = quantity * unitPrice, luôn tính lại bởi computeQuoteTotals(), không nhập tay. */
  amount: number;
}

export interface Quote extends Omit<BaseEntity, "status"> {
  status: QuoteStatus;
  quoteNo: string;
  /** yyyy-MM-dd */
  quoteDate: string;
  customerId: string;
  /** yyyy-MM-dd */
  validFrom: string;
  validTo: string;
  items: QuoteItem[];
  /** = SUM(items.amount), luôn tính lại bởi computeQuoteTotals(). */
  totalAmount: number;
}
