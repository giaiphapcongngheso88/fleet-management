import { format, parseISO } from "date-fns";
import { createCrudService } from "@/lib/firestoreCrud";
import { getNextSequence } from "@/lib/sequence";
import { Quote, QuoteItem } from "@/types/quote";

// Dữ liệu giao dịch — KHÔNG bật cache (mục 2.4: chỉ cache danh mục/bảng giá).
export const quoteService = createCrudService<Quote>("quotes");

/** Sinh số báo giá BG-yyyyMM-00001 (mục 43), số chạy theo từng tháng. */
export async function generateQuoteNo(quoteDate: string): Promise<string> {
  const monthKey = format(parseISO(quoteDate), "yyyyMM");
  const seq = await getNextSequence(`quote-${monthKey}`);
  return `BG-${monthKey}-${String(seq).padStart(5, "0")}`;
}

/** Tổng tiền báo giá (mục 28.2) — hàm thuần, gọi lại mỗi khi items thay đổi. */
export function computeQuoteTotals(items: QuoteItem[]): { totalAmount: number } {
  return { totalAmount: items.reduce((sum, item) => sum + (item.amount || 0), 0) };
}
