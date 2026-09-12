import { cn } from "@/app/lib/utils";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export interface KpiCardData {
  label: string;
  value: number;
  icon: LucideIcon;
  highlight?: "success" | "error";
}

const ICON_WRAP_CLASS: Record<"default" | "success" | "error", string> = {
  default: "bg-brand-50 text-brand-500 dark:bg-brand-500/10",
  success: "bg-success-50 text-success-600 dark:bg-success-500/15",
  error: "bg-error-50 text-error-500 dark:bg-error-500/15",
};

/** Thẻ KPI dùng chung cho Dashboard (mục 33) và Báo cáo tổng hợp (mục 32) — cùng 1 kiểu trình bày. */
export function KpiCard({ card, extra }: { card: KpiCardData; extra?: ReactNode }) {
  const Icon = card.icon;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-white/3 flex items-start gap-2 sm:gap-3">
      <div
        className={cn(
          // aspect-square đảm bảo luôn là hình tròn (1:1) dù flexbox có tính lại chiều rộng thế nào —
          // chỉ đặt riêng h-* (không đặt w-*) để aspect-square tự suy ra chiều rộng bằng chiều cao.
          "shrink-0 flex items-center justify-center h-7 sm:h-10 aspect-square rounded-full",
          ICON_WRAP_CLASS[card.highlight ?? "default"]
        )}
      >
        <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 truncate">{card.label}</p>
        <p
          className={cn(
            // Số tiền vài tỷ (13-14 ký tự) có thể rộng hơn thẻ trên mobile — không dùng truncate
            // (sẽ cắt mất số), cho phép xuống dòng thay vì tràn ngang thẻ; giảm cỡ chữ + icon trên
            // mobile để hạn chế phải xuống dòng ở mức số tiền thông thường.
            "text-sm sm:text-lg font-semibold text-gray-800 dark:text-white/90 wrap-break-word tracking-tight",
            card.highlight === "error" && "text-error-500",
            card.highlight === "success" && "text-success-600"
          )}
        >
          {currencyFormatter.format(card.value)}
        </p>
        {extra}
      </div>
    </div>
  );
}
