import { format, startOfMonth } from "date-fns";
import { DATE_FORMAT } from "@/app/lib/enums";

/**
 * Khoảng ngày mặc định cho bộ lọc (mục 44.1 spec nghiệp vụ): từ ngày 01 tháng hiện tại đến hôm nay.
 * Khớp chu kỳ đối soát/chốt sổ theo tháng, tránh tải toàn bộ lịch sử ngay lần mở đầu tiên.
 */
export function getCurrentMonthRange(): { from: string; to: string } {
  const today = new Date();
  return {
    from: format(startOfMonth(today), DATE_FORMAT.YYYY_MM_DD),
    to: format(today, DATE_FORMAT.YYYY_MM_DD),
  };
}
