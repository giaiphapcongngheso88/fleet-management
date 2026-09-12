/**
 * Chuyển 1 dòng báo giá đã duyệt thành chuyến thực tế (mục 28.5 "nhân bản", mở rộng sang Chuyến xe).
 * Báo giá và Chuyến xe là 2 trang riêng biệt (route riêng) nên dùng sessionStorage làm cầu nối tạm —
 * đơn giản hơn serialize toàn bộ dữ liệu dòng báo giá vào query string, và tự dọn sau khi đọc 1 lần.
 */
const KEY = "quoteToTripPrefill";

export interface QuoteToTripPrefill {
  customerId: string;
  pickupLocationId: string;
  dropoffLocationId: string;
  productId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export function setQuoteToTripPrefill(data: QuoteToTripPrefill) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

/** Đọc và xóa ngay — chỉ áp dụng đúng 1 lần cho form Tạo chuyến kế tiếp. */
export function consumeQuoteToTripPrefill(): QuoteToTripPrefill | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as QuoteToTripPrefill;
  } catch {
    return null;
  }
}
