"use client";

import { Input, inputVariants } from "@/components/ui/input";
import { VariantProps } from "class-variance-authority";
import * as React from "react";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

/**
 * Ô nhập số tiền, tự format phân cách hàng nghìn khi gõ (mục 51: hiển thị số tiền phải dễ đọc).
 * `<input type="number">` không thể hiển thị dấu phân cách (trình duyệt từ chối ký tự không phải số),
 * nên dùng `type="text"` + `inputMode="numeric"`, tự lọc ký tự không phải số khi đổi giá trị.
 */
export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "size">,
    VariantProps<typeof inputVariants> {
  value: number;
  onChange: (value: number) => void;
  error?: boolean;
  /** Cho phép số âm (vd: điều chỉnh lương +/- có thể là khoản phạt âm). Mặc định false. */
  allowNegative?: boolean;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, onFocus, allowNegative, ...props }, ref) => {
    const display = value ? currencyFormatter.format(value) : value === 0 ? "0" : "";
    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={allowNegative ? "text" : "numeric"}
        value={display}
        onFocus={(e) => {
          e.target.select();
          onFocus?.(e);
        }}
        onChange={(e) => {
          const isNegative = allowNegative && e.target.value.trim().startsWith("-");
          const digits = e.target.value.replace(/[^0-9]/g, "");
          const parsed = digits ? Number(digits) : 0;
          onChange(isNegative ? -parsed : parsed);
        }}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
