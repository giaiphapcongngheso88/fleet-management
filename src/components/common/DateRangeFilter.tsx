"use client";

import { DATE_FORMAT } from "@/app/lib/enums";
import { Button } from "@/components/ui/button";
import { InputDatePicker } from "@/components/ui/input-date-picker";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCurrentMonthRange } from "@/utils/dateRange";
import { format, isValid, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { useState } from "react";

export interface DateRange {
  /** yyyy-MM-dd */
  from: string;
  /** yyyy-MM-dd */
  to: string;
}

/**
 * Bộ lọc khoảng ngày dùng chung (mục 44.1 spec nghiệp vụ) — lọc phía client trên dữ liệu đã tải.
 * Mặc định gợi ý dùng `getCurrentMonthRange()` (tháng hiện tại) ở nơi khởi tạo state của trang cha.
 *
 * Ẩn mặc định sau 1 nút "Bộ lọc ngày" (mục 44.2 spec) — không chiếm chỗ màn hình khi chưa cần đổi
 * khoảng ngày mặc định, bấm nút mới hiện ra 2 ô ngày. Dùng Popover (nổi đè lên trên qua portal) thay
 * vì mở rộng ngay trong luồng layout — các khung cha trong app hay dùng `overflow-hidden`, mở rộng
 * inline dễ bị cắt mất nội dung (vd: nút "Tháng này" bị che). Áp dụng đồng nhất cho mọi trang dùng
 * component này, không cần cài lại logic ở từng trang.
 */
export function DateRangeFilter({
  value,
  onChange,
  className,
  inline = false,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  inline?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toDate = (s: string) => {
    const parsed = parseISO(s);
    return isValid(parsed) ? parsed : undefined;
  };
  const toStr = (d?: Date) => (d ? format(d, DATE_FORMAT.YYYY_MM_DD) : "");
  const toShort = (s: string) => {
    const d = toDate(s);
    return d ? format(d, "dd/MM") : s;
  };

  const fields = (
    <div className={className ?? "flex flex-col gap-2"}>
      <div className="flex items-center gap-1.5">
        <Label className="w-8 shrink-0 whitespace-nowrap text-xs">Từ</Label>
        <InputDatePicker
          size="sm"
          clearable={false}
          value={toDate(value.from)}
          onChange={(d) => onChange({ ...value, from: toStr(d) })}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="w-8 shrink-0 whitespace-nowrap text-xs">Đến</Label>
        <InputDatePicker
          size="sm"
          clearable={false}
          value={toDate(value.to)}
          onChange={(d) => onChange({ ...value, to: toStr(d) })}
        />
      </div>
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange(getCurrentMonthRange())}>
        Tháng này
      </Button>
    </div>
  );

  if (inline) return fields;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          {/* Luôn hiện khoảng ngày đang áp dụng trên nút, kể cả khi đang ẩn — tránh người dùng
              tưởng không có lọc gì trong khi dữ liệu vẫn đang bị lọc theo khoảng ngày mặc định. */}
          Bộ lọc ngày: {toShort(value.from)} - {toShort(value.to)}
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 max-w-[calc(100vw-2rem)] z-120">
        {fields}
      </PopoverContent>
    </Popover>
  );
}
